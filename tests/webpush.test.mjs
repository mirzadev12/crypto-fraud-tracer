import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from "node:crypto";
import {
  encryptPayload,
  generateVapidKeys,
  isPushEndpoint,
  sendPush,
  validPushKeys,
  vapidKeysMatch,
  vapidToken,
} from "../lib/webpush.ts";

const b64u = (s) => Buffer.from(s.replace(/\s+/g, ""), "base64url");

// RFC 8291, section 5 and Appendix A, copied as printed (whitespace is the RFC's line wrapping).
const RFC = {
  plaintext: b64u("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24"),
  asPrivate: b64u("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcx aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: b64u("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94"),
  salt: b64u("DGv6ra1nlYgDCS1FRnbzlw"),
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  header: b64u(
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z 9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml mlMoZIIgDll6e3vCYLocInmYWAmS6Tlz AC8wEqKK6PBru3jl7A8",
  ),
  ciphertext: b64u("8pfeW0KbunFT06SuDKoJH9Ql87S1QUrd irN6GcG7sFz1y1sqLgVi1VhjVkHsUoEs bI_0LpXMuGvnzQ"),
};

/** Decrypt as a browser would, written from the RFC rather than from lib/webpush.ts. */
function browserDecrypt(body, uaPrivate, uaPublic, auth) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(uaPrivate);
  const secret = ecdh.computeSecret(asPublic);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", secret, auth, info, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const sealed = body.subarray(21 + idlen);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  const padded = Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]);
  assert.equal(padded[padded.length - 1], 2, "one record, ending with the last-record delimiter");
  return padded.subarray(0, padded.length - 1);
}

function browserKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    priv: ecdh.getPrivateKey(),
    pub: ecdh.getPublicKey(),
    auth: Buffer.from("0123456789abcdef"),
  };
}

test("encryption reproduces RFC 8291's worked example byte for byte", () => {
  const body = encryptPayload(
    RFC.plaintext,
    { p256dh: RFC.uaPublic.replace(/\s+/g, ""), auth: RFC.auth },
    { salt: RFC.salt, asPrivate: RFC.asPrivate },
  );
  assert.equal(body.length, 86 + RFC.ciphertext.length, "an 86-octet header, then the ciphertext");
  assert.equal(body.subarray(0, 86).toString("base64url"), RFC.header.toString("base64url"));
  assert.equal(body.subarray(86).toString("base64url"), RFC.ciphertext.toString("base64url"));
  // And the example decrypts with the browser's private key from the RFC.
  const plain = browserDecrypt(body, RFC.uaPrivate, b64u(RFC.uaPublic), b64u(RFC.auth));
  assert.equal(plain.toString(), "When I grow up, I want to be a watermelon");
});

test("a fresh message decrypts for its browser, and differs every time", () => {
  const ua = browserKeys();
  const keys = { p256dh: ua.pub.toString("base64url"), auth: ua.auth.toString("base64url") };
  const message = Buffer.from(JSON.stringify({ title: "Funds moved", body: "test" }));
  const a = encryptPayload(message, keys);
  const b = encryptPayload(message, keys);
  assert.notEqual(a.toString("hex"), b.toString("hex"), "fresh salt and server key per message");
  assert.equal(browserDecrypt(a, ua.priv, ua.pub, ua.auth).toString(), message.toString());
  assert.throws(() => encryptPayload(Buffer.alloc(3_001), keys), /too long/);
});

test("the VAPID token is ES256, names its push service, and verifies with the public key", () => {
  const keys = generateVapidKeys();
  const now = 1_790_000_000;
  const token = vapidToken("https://fcm.googleapis.com", "https://example.org/contact", keys, now);
  const [h, c, s] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { typ: "JWT", alg: "ES256" });
  assert.deepEqual(JSON.parse(Buffer.from(c, "base64url")), {
    aud: "https://fcm.googleapis.com",
    exp: now + 12 * 3600,
    sub: "https://example.org/contact",
  });
  const pub = Buffer.from(keys.publicKey, "base64url");
  const key = createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: pub.subarray(1, 33).toString("base64url"),
      y: pub.subarray(33).toString("base64url"),
    },
    format: "jwk",
  });
  const sig = Buffer.from(s, "base64url");
  assert.equal(sig.length, 64, "raw r‖s, as JOSE requires");
  assert.ok(verify("sha256", Buffer.from(`${h}.${c}`), { key, dsaEncoding: "ieee-p1363" }, sig));
});

test("keys are checked as a pair, and a browser's keys for shape", () => {
  const a = generateVapidKeys();
  const b = generateVapidKeys();
  assert.equal(Buffer.from(a.publicKey, "base64url").length, 65);
  assert.equal(Buffer.from(a.privateKey, "base64url").length, 32);
  assert.ok(vapidKeysMatch(a));
  assert.equal(vapidKeysMatch({ publicKey: a.publicKey, privateKey: b.privateKey }), false);
  assert.equal(vapidKeysMatch({ publicKey: "x", privateKey: "y" }), false);

  const ua = browserKeys();
  assert.ok(validPushKeys({ p256dh: ua.pub.toString("base64url"), auth: ua.auth.toString("base64url") }));
  assert.equal(validPushKeys({ p256dh: ua.pub.toString("base64url"), auth: "short" }), false);
  assert.equal(validPushKeys({ p256dh: "AAAA", auth: ua.auth.toString("base64url") }), false);
});

test("only the browsers' own push services are accepted as endpoints", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://wns2-pn1p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/QGuQyavXutnMH8",
  ]) {
    assert.ok(isPushEndpoint(ok), ok);
  }
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evil.example/fcm.googleapis.com",
    "https://user:pw@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://localhost/x",
    "not a url",
  ]) {
    assert.equal(isPushEndpoint(bad), false, bad);
  }
});

test("a push is posted as the standards require, and a withdrawn subscription reads as gone", async () => {
  const ua = browserKeys();
  const keys = generateVapidKeys();
  let seen;
  let reply = 201;
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen = { headers: req.headers, body: Buffer.concat(chunks) };
      res.writeHead(reply);
      res.end(reply === 201 ? "" : "push subscription has unsubscribed or expired");
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const endpoint = `http://127.0.0.1:${server.address().port}/push/abc`;
  const target = { endpoint, keys: { p256dh: ua.pub.toString("base64url"), auth: ua.auth.toString("base64url") } };
  try {
    const sent = await sendPush(target, { title: "Funds moved" }, keys, "https://example.org");
    assert.deepEqual(sent, { status: 201, ok: true, gone: false });
    assert.equal(seen.headers["content-encoding"], "aes128gcm");
    assert.equal(seen.headers.ttl, String(24 * 3600));
    assert.equal(seen.headers.urgency, "high");
    assert.match(seen.headers.authorization, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${keys.publicKey}$`));
    const claims = JSON.parse(Buffer.from(seen.headers.authorization.split(".")[1], "base64url"));
    assert.equal(claims.aud, new URL(endpoint).origin, "the audience is the push service's origin");
    assert.deepEqual(JSON.parse(browserDecrypt(seen.body, ua.priv, ua.pub, ua.auth)), { title: "Funds moved" });

    reply = 410;
    const gone = await sendPush(target, { title: "x" }, keys, "https://example.org");
    assert.equal(gone.gone, true);
    assert.equal(gone.ok, false);
    assert.match(gone.detail, /unsubscribed or expired/);
  } finally {
    server.close();
  }
  const unreachable = await sendPush(target, { title: "x" }, keys, "https://example.org");
  assert.deepEqual([unreachable.status, unreachable.ok, unreachable.gone], [0, false, false]);
});
