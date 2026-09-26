"use client";

/**
 * The shared case file from the browser (`/api/cases`). Every request says who
 * is asking, so saving and removing are attributed in the audit log.
 */

import type { SavedCase } from "./case-file";
import { findingsFingerprint } from "./fingerprint";
import { officerHeaders } from "./officer";
import type { TraceResult } from "./types";

type Failed = { ok: false; error: string };

async function send<T>(method: string, body?: unknown): Promise<T | Failed> {
  try {
    const res = await fetch("/api/cases", {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...officerHeaders() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` };
    return json as T;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "the server did not answer" };
  }
}

export async function listCases(): Promise<{ ok: true; cases: SavedCase[] } | Failed> {
  const r = await send<SavedCase[]>("GET");
  return Array.isArray(r) ? { ok: true, cases: r } : (r as Failed);
}

/**
 * Save the run on screen. The server looks it up in its own audit log by the
 * findings fingerprint, so what is saved is what the server traced.
 */
export function saveCase(trace: TraceResult) {
  return send<{ ok: true; already: boolean; case: SavedCase }>("POST", {
    address: trace.inputAddress,
    fingerprint: findingsFingerprint(trace),
  });
}

export function removeCase(id: string) {
  return send<{ ok: true; removed: boolean }>("DELETE", { id });
}

export function isSaved(cases: SavedCase[], trace: TraceResult, fingerprint = findingsFingerprint(trace)): boolean {
  return cases.some((c) => c.inputAddress === trace.inputAddress && c.fingerprint === fingerprint);
}
