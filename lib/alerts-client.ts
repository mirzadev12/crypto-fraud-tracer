"use client";

/**
 * Alerts when the desk is closed — the browser's half.
 *
 * Turning alerts on asks the browser's permission to notify, subscribes to its
 * push service with the server's public key, and hands the server this
 * browser's watch list. After that the list is sent again whenever it changes
 * (`lib/watchlist.ts`) and whenever the desk opens, so the server's copy is
 * never more than one desk-opening out of date — including after a restart
 * that lost it, or a new server key, which is noticed here and answered by
 * subscribing again without asking the officer anything.
 *
 * Only `turnOnAlerts` ever asks for permission, and only from a button press.
 */

import type { RunSummary } from "./alerts";
import { officerHeaders } from "./officer";
import type { WatchItem } from "./watch";

/** JSON, and who is asking — turning alerts on or off goes into the audit log. */
const jsonHeaders = () => ({ "Content-Type": "application/json", ...officerHeaders() });

export type AlertStatus =
  | { kind: "unsupported" }
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "on"; server: ServerAlerts }
  | { kind: "error"; reason: string };

export interface ServerAlerts {
  available: boolean;
  publicKey?: string;
  everyMinutes?: number;
  lastRun?: RunSummary | null;
  /** False when three rounds have been missed: the server was not running. */
  current?: boolean;
  error?: string;
}

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : "the browser refused";
}

export async function serverAlerts(): Promise<ServerAlerts> {
  try {
    const res = await fetch("/api/alerts", { cache: "no-store" });
    const json = (await res.json()) as ServerAlerts;
    return res.ok && json.available && json.publicKey
      ? json
      : { available: false, error: json.error ?? `HTTP ${res.status}` };
  } catch (err) {
    return { available: false, error: reason(err) };
  }
}

function keyBytes(publicKey: string): Uint8Array<ArrayBuffer> {
  const b64 = publicKey.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(held: ArrayBuffer | null, publicKey: string): boolean {
  if (!held) return false;
  const a = new Uint8Array(held);
  const b = keyBytes(publicKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Tell the server to drop a subscription. Best effort: a server that cannot be reached drops it on its next refused push. */
async function forget(endpoint: string): Promise<void> {
  await fetch("/api/alerts", {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);
}

/**
 * The browser's subscription under the server's current key. A subscription
 * made under an older key — the server lost it and made another — is replaced,
 * and the server told to drop the old one; permission was given already, so no
 * prompt appears.
 */
async function subscribed(
  registration: ServiceWorkerRegistration,
  publicKey: string,
  create: boolean,
): Promise<PushSubscription | null> {
  const held = await registration.pushManager.getSubscription();
  if (held && sameKey(held.options.applicationServerKey, publicKey)) return held;
  if (held) {
    await forget(held.endpoint);
    await held.unsubscribe().catch(() => false);
  } else if (!create) {
    return null;
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
}

async function hand(subscription: PushSubscription, items: WatchItem[]): Promise<void> {
  const { endpoint, keys } = subscription.toJSON();
  const res = await fetch("/api/alerts", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ subscription: { endpoint, keys }, items }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
}

/**
 * Where alerts stand in this browser, sending the server the current list if
 * they are on. Never prompts, so it is safe on every page load.
 */
export async function syncAlerts(items: WatchItem[]): Promise<AlertStatus> {
  if (!supported()) return { kind: "unsupported" };
  if (Notification.permission === "denied") return { kind: "blocked" };
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration || Notification.permission !== "granted") return { kind: "off" };
    if (!(await registration.pushManager.getSubscription())) return { kind: "off" };
    const server = await serverAlerts();
    if (!server.publicKey) return { kind: "error", reason: server.error ?? "the server did not answer" };
    const subscription = await subscribed(registration, server.publicKey, false);
    if (!subscription) return { kind: "off" };
    await hand(subscription, items);
    return { kind: "on", server };
  } catch (err) {
    return { kind: "error", reason: reason(err) };
  }
}

/** From a button press only: the one place permission is asked for. */
export async function turnOnAlerts(items: WatchItem[]): Promise<AlertStatus> {
  if (!supported()) return { kind: "unsupported" };
  try {
    const permission = await Notification.requestPermission();
    if (permission === "denied") return { kind: "blocked" };
    if (permission !== "granted") return { kind: "off" };
    const server = await serverAlerts();
    if (!server.publicKey) return { kind: "error", reason: server.error ?? "the server did not answer" };
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const registration = await navigator.serviceWorker.ready;
    const subscription = await subscribed(registration, server.publicKey, true);
    if (!subscription) return { kind: "off" };
    await hand(subscription, items);
    return { kind: "on", server };
  } catch (err) {
    return { kind: "error", reason: reason(err) };
  }
}

export async function turnOffAlerts(): Promise<AlertStatus> {
  if (!supported()) return { kind: "unsupported" };
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await forget(subscription.endpoint);
      await subscription.unsubscribe();
    }
    return { kind: "off" };
  } catch (err) {
    return { kind: "error", reason: reason(err) };
  }
}
