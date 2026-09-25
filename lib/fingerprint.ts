/**
 * A case's findings fingerprint: one SHA-256 over what the case found.
 *
 * The evidence packet already lists the SHA-256 of every chain response it was
 * built from, but those digests cannot be checked later: a response body
 * carries the moment it was served (and, on Ethereum, a price), so the same
 * query answers with different bytes tomorrow. What *can* be checked later is
 * the finding itself — confirmed transfers never change, and a pinned run
 * (`asof`) re-derives the same case on any later day. So the packet carries
 * the digest of the finding, and anyone holding a copy can have FineX
 * re-derive the case from the public chain and compare.
 *
 * Covered: the run (chain, reported address, amount, window, the moment read),
 * the disposition, the exit, every wallet with its attribution (entity, kind,
 * source, confidence) and the victim money that reached it, every transfer
 * (hash, from, to, amount, time, time held) and every rule that fired, and
 * where. Not covered: the sentences. Prose is derived from these facts, and a
 * later FineX that words a finding better must not make an older packet fail
 * its check; the figures a sentence states are all covered.
 *
 * Synchronous — the same SHA-256 the address checks use — so a document can
 * print its fingerprint during render.
 */

import type { Label, TraceResult } from "./types";
import { sha256 } from "./tron";

/** Named in the digest, so a later change of what is covered cannot collide with this one. */
export const FINGERPRINT_SCHEME = "finex-findings-v1";

const iso = (t: string) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toISOString();
};
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const label = (l: Label | null) =>
  l ? [l.entity, l.kind, l.source, l.confidence.toFixed(2)] : null;

/** The exact text that is hashed. Exported so a reader can see what the digest covers. */
export function findingsCanonical(trace: TraceResult): string {
  const nodes = trace.nodes
    .map((n) => [n.address, label(n.label), n.taintedValueUsdt.toFixed(2)] as const)
    .sort((a, b) => cmp(a[0], b[0]));
  const edges = trace.edges
    .map((e) => [
      e.txHash,
      e.from,
      e.to,
      e.valueUsdt.toFixed(6),
      iso(e.timestamp),
      e.dwellSeconds === null ? null : Math.round(e.dwellSeconds),
    ])
    .sort((a, b) => cmp(JSON.stringify(a), JSON.stringify(b)));
  const flags = trace.riskFlags
    .map((f) => [f.code, f.atAddress])
    .sort((a, b) => cmp(a.join(" "), b.join(" ")));
  const terminal = trace.terminal
    ? [trace.terminal.address, trace.terminal.depositAddress, label(trace.terminal.label)]
    : null;
  return JSON.stringify([
    FINGERPRINT_SCHEME,
    trace.chain,
    trace.inputAddress,
    trace.reportedAmountUsdt.toFixed(6),
    iso(trace.fraudDate),
    iso(trace.provenance.generatedAt),
    trace.triage,
    terminal,
    nodes,
    edges,
    flags,
  ]);
}

export function findingsFingerprint(trace: TraceResult): string {
  const digest = sha256(new TextEncoder().encode(findingsCanonical(trace)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A fingerprint as printed: eight groups of eight, so two copies can be compared by eye. */
export function groupFingerprint(fp: string): string {
  return fp.match(/.{1,8}/g)?.join(" ") ?? fp;
}

/** A fingerprint carried in a link; anything but 64 hex digits is dropped. */
export function readFingerprint(raw: string | string[] | undefined): string | undefined {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{64}$/.test(value) ? value : undefined;
}

/**
 * The link that checks a copy of a packet: the packet's own run, pinned, plus
 * the fingerprint it printed. It carries exactly the parameters the packet was
 * given — an amount or a window left automatic stays automatic, because a
 * window stated explicitly is a reported date, and the NEW_ADDRESS rule reads
 * that difference — and pins the moment the run was read.
 */
export function verifyHref(
  run: { address: string; amount?: number; since?: string; asOf: string; ack?: string },
  fingerprint: string,
): string {
  const query = new URLSearchParams();
  if (run.amount && run.amount > 0) query.set("amount", String(run.amount));
  if (run.since) query.set("since", run.since);
  query.set("asof", run.asOf);
  if (run.ack) query.set("ack", run.ack);
  query.set("fp", fingerprint);
  return `/report/${encodeURIComponent(run.address)}?${query.toString()}`;
}

/**
 * The check link for a document built from `trace`. A live run carries the
 * amount and window the document was given (automatic stays automatic); a
 * recorded one is the captured run, whose own figures are what re-derive it,
 * however the document was opened. An illustrative case has none: there is no
 * chain record to check it against.
 */
export function checkHref(
  trace: TraceResult,
  source: "live" | "demo" | "illustrative",
  given: { amount?: number; since?: string; asOf?: string; ack?: string },
  fingerprint: string = findingsFingerprint(trace),
): string | null {
  if (source === "illustrative") return null;
  const run =
    source === "demo"
      ? { amount: trace.reportedAmountUsdt, since: trace.fraudDate, asOf: trace.provenance.generatedAt }
      : { amount: given.amount, since: given.since, asOf: given.asOf ?? trace.provenance.generatedAt };
  return verifyHref({ address: trace.inputAddress, ...run, ack: given.ack }, fingerprint);
}
