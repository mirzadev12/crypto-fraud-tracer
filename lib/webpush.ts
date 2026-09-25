/**
 * Web Push, with nothing but `node:crypto`.
 *
 * An alert has to reach an officer whose FineX tab is closed, and the one way
 * to do that without an email provider, an SMS gateway or anyone's API key is
 * the browser's own push service: the browser subscribes once, and the server
 * can then wake it with a notification. Three short standards make it work:
 *
 *  - **RFC 8291** — the message is encrypted to the browser's own key, so the
 *    push service that relays it (Google, Mozilla, Apple, Microsoft) cannot
 *    read which wallet moved;
 *  - **RFC 8188** — the `aes128gcm` content coding that carries it;
 *  - **RFC 8292** — VAPID, a signed token proving the message comes from the
 *    server the browser subscribed to, and no other.
 *
 * No dependency (AGENTS.md §3): the whole of it is one key agreement, three
 * HKDF derivations, one AES-GCM seal and one ES256 signature. The encryption is
 * checked in `tests/webpush.test.mjs` against RFC 8291's own worked example,
 * byte for byte, so it is not checked only against itself.
 *
 * Server-only.
 */

import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign,
} from "node:crypto";

/** The server's push identity. Both halves base64url, as browsers and the RFCs write them. */
export interface VapidKeys {
  /** The 65-byte uncompressed P-256 point a browser subscribes with. Public. */
  publicKey: string;
  /** The 32-byte private scalar. Never leaves the server. */
  privateKey: string;
}

/** What a browser hands over when it subscribes (`PushSubscription.toJSON()`). */
export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushOutcome {
  /** HTTP status from the push service; 0 when it could not be reached. */
  status: number;
  ok: boolean;
  /**
   * The subscription is finished: expired or withdrawn (404, 410), or it no
   * longer accepts this server's key (401, 403) — which is what a key change
   * after a restart looks like. The browser subscribes again the next time the
   * desk opens, so a gone subscription is dropped rather than retried forever.
   */
  gone: boolean;
  /** The push service's own words on a refusal, for the server log. */
  detail?: string;
}

const b64u = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const unb64u = (text: string) => Buffer.from(text, "base64url");

/** One record, as every browser expects; far more than an alert needs. */
const RECORD_SIZE = 4096;
/** Room for the header, the padding delimiter and the tag inside one record. */
const MAX_PLAINTEXT = 3_000;
/** How long a push service keeps an alert for a browser that is offline. */
const TTL_SECONDS = 24 * 3600;

export function generateVapidKeys(): VapidKeys {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const point = Buffer.concat([Buffer.from([4]), unb64u(jwk.x!), unb64u(jwk.y!)]);
  return { publicKey: b64u(point), privateKey: jwk.d! };
}

/** Is this a usable pair — the private half producing exactly the public one? */
export function vapidKeysMatch(keys: VapidKeys): boolean {
  try {
    const pub = unb64u(keys.publicKey);
    const priv = unb64u(keys.privateKey);
    if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32) return false;
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(priv);
    return ecdh.getPublicKey().equals(pub);
  } catch {
    return false;
  }
}

/**
 * A browser's p256dh key and auth secret, checked before anything is stored:
 * the right lengths, and a point that is really on the curve — a key that
 * cannot be agreed with would otherwise fail on every check, forever.
 */
export function validPushKeys(keys: { p256dh: string; auth: string }): boolean {
  const pub = unb64u(keys.p256dh);
  if (pub.length !== 65 || pub[0] !== 4 || unb64u(keys.auth).length !== 16) return false;
  try {
    const probe = createECDH("prime256v1");
    probe.generateKeys();
    probe.computeSecret(pub);
    return true;
  } catch {
    return false;
  }
}

/**
 * The push services browsers actually use, and nothing else. A subscription
 * names the URL the server will later POST to, so accepting any URL would let
 * anyone make this server send requests wherever they liked.
 */
const PUSH_HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/, // Chrome, Edge on Android, Opera, Brave, Samsung
  /(^|\.)push\.services\.mozilla\.com$/, // Firefox
  /(^|\.)notify\.windows\.com$/, // Edge on Windows
  /(^|\.)push\.apple\.com$/, // Safari
];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.port === "" || url.port === "443") &&
      PUSH_HOSTS.some((host) => host.test(url.hostname))
    );
  } catch {
    return false;
  }
}

/**
 * RFC 8291: encrypt a message to one browser.
 *
 * `fixed` exists for the test against the RFC's worked example, which needs
 * the example's own salt and server key; in use both are fresh every time.
 */
export function encryptPayload(
  plaintext: Uint8Array,
  keys: { p256dh: string; auth: string },
  fixed: { salt?: Buffer; asPrivate?: Buffer } = {},
): Buffer {
  if (plaintext.length > MAX_PLAINTEXT) throw new Error("Push message too long.");
  const uaPublic = unb64u(keys.p256dh);
  const authSecret = unb64u(keys.auth);

  const ecdh = createECDH("prime256v1");
  if (fixed.asPrivate) ecdh.setPrivateKey(fixed.asPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);

  // Combine the key agreement with the browser's auth secret…
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", ecdhSecret, authSecret, keyInfo, 32));
  // …then derive this message's key and nonce from a fresh salt.
  const salt = fixed.salt ?? randomBytes(16);
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  // One record, so the padding delimiter is 0x02 ("last record") and no padding follows.
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const sealed = Buffer.concat([
    cipher.update(Buffer.concat([plaintext, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  // RFC 8188 header: salt, record size, and the server's one-time public key as the key id.
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, sealed]);
}

/** RFC 8292: a token, valid for twelve hours, naming the push service it is for. */
export function vapidToken(
  audience: string,
  subject: string,
  keys: VapidKeys,
  nowSeconds: number,
): string {
  const pub = unb64u(keys.publicKey);
  const signingKey = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: keys.privateKey,
      x: b64u(pub.subarray(1, 33)),
      y: b64u(pub.subarray(33, 65)),
    },
    format: "jwk",
  });
  const part = (value: object) => b64u(Buffer.from(JSON.stringify(value)));
  const input = `${part({ typ: "JWT", alg: "ES256" })}.${part({
    aud: audience,
    exp: nowSeconds + 12 * 3600,
    sub: subject,
  })}`;
  // JOSE wants the raw r‖s pair, not the DER encoding Node signs with by default.
  const signature = sign("sha256", Buffer.from(input), { key: signingKey, dsaEncoding: "ieee-p1363" });
  return `${input}.${b64u(signature)}`;
}

/** Send one push. Never throws: an unreachable service is an outcome, not a crash. */
export async function sendPush(
  target: PushTarget,
  message: unknown,
  keys: VapidKeys,
  subject: string,
  now: number = Date.now(),
): Promise<PushOutcome> {
  try {
    const body = encryptPayload(Buffer.from(JSON.stringify(message)), target.keys);
    const token = vapidToken(new URL(target.endpoint).origin, subject, keys, Math.floor(now / 1000));
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        TTL: String(TTL_SECONDS),
        Urgency: "high",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Authorization: `vapid t=${token}, k=${keys.publicKey}`,
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(15_000),
    });
    const detail = res.ok ? undefined : (await res.text().catch(() => "")).slice(0, 200);
    return {
      status: res.status,
      ok: res.ok,
      gone: [401, 403, 404, 410].includes(res.status),
      ...(detail ? { detail } : {}),
    };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      gone: false,
      detail: err instanceof Error ? err.message : "unreachable",
    };
  }
}
