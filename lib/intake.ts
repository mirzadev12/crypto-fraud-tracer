/**
 * What batch triage accepts: a pasted list of addresses, or a complaint sheet.
 *
 * A list is what it always was — addresses (and now transaction hashes)
 * separated by lines, commas or semicolons.
 *
 * A complaint sheet is a CSV (or a tab-separated paste from a spreadsheet)
 * whose first row names its columns. It is recognised by a column for the
 * wallet or transaction; the others are optional:
 *
 *   acknowledgement number · wallet or transaction · amount · date · state
 *
 * Each row is one complaint, traced with its own amount and date instead of
 * the automatic defaults, and its acknowledgement number travels with it to
 * the evidence packet and the freeze request. Column names are matched
 * loosely ("Ack No", "NCRP acknowledgement", "Suspect wallet", "Txn hash",
 * "Amount (USDT)", "Date of fraud") because every export names them its own way.
 *
 * Two India-specific readings, stated because they change what is traced:
 * a date is read day first (03/04/2026 is 3 April), and a date or time with no
 * time zone is read as IST — the time zone a complaint filed in India means.
 * Nothing that fails a check is guessed at: the row is listed as rejected with
 * the reason, and the rest of the sheet still runs.
 */

import { checkAddress } from "./address";
import { identifyChain } from "./chains";
import { canonicalState } from "./states";
import { isTxHash } from "./tron";

export interface IntakeJob {
  /** One per complaint: its acknowledgement number, or the wallet it names. */
  key: string;
  /** The wallet (canonical spelling) or the transaction hash as given. */
  input: string;
  kind: "address" | "tx";
  ack?: string;
  amount?: number;
  /** ISO timestamp. */
  fraudDate?: string;
  /**
   * The state or union territory the complaint belongs to, canonical where it
   * names one (lib/states.ts), otherwise as written. Not `state`: batch triage
   * uses that word for a row's progress.
   */
  stateUt?: string;
}

export interface IntakeRejected {
  line: string;
  reason: string;
}

export interface Intake {
  jobs: IntakeJob[];
  rejected: IntakeRejected[];
  /** True when the input was read as a complaint sheet with a header row. */
  sheet: boolean;
}

const ACK = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,39}$/;
/** IST is five and a half hours ahead of UTC, all year. */
const IST_OFFSET_MS = 330 * 60_000;

/* ------------------------------------------------------------------ columns */

const COLUMN: Record<"subject" | "ack" | "amount" | "date" | "state", RegExp> = {
  subject: /(wallet|address|transaction|txn|tx|hash)/i,
  ack: /(ack|acknowledg|ncrp|complaint\s*(no|number|id)|reference)/i,
  amount: /(amount|usdt|loss|value)/i,
  date: /(date|when|time)/i,
  // "State", "State/UT", "Union territory" — but not "Statement".
  state: /\b(state|union\s*territory)\b/i,
};

/** Split one CSV line, honouring double quotes ("a, b" and "" inside quotes). */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += c;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function delimiterOf(header: string): string {
  if (header.includes("\t")) return "\t";
  if (header.includes(";") && !header.includes(",")) return ";";
  return ",";
}

/* ------------------------------------------------------------------ values */

/** A positive USDT amount, allowing "1,234.56" and a trailing "USDT"; null when it is not one. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/usdt/i, "").replace(/\s/g, "");
  if (!/^\d[\d,]*(\.\d+)?$/.test(s)) return null;
  const n = Number(s.replaceAll(",", ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A date or date-time as an ISO timestamp, or null. Accepts ISO (with or
 * without a zone), and day-first DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY with an
 * optional HH:MM[:SS]. Anything without a zone is IST.
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/i);
  if (iso) {
    const [, y, mo, d, h = "0", mi = "0", se = "0", zone] = iso;
    if (zone) {
      const t = Date.parse(s.replace(" ", "T"));
      return Number.isFinite(t) ? new Date(t).toISOString() : null;
    }
    return fromIst(+y, +mo, +d, +h, +mi, +se);
  }
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    const [, d, mo, y, h = "0", mi = "0", se = "0"] = dmy;
    return fromIst(+y, +mo, +d, +h, +mi, +se);
  }
  return null;
}

function fromIst(y: number, mo: number, d: number, h: number, mi: number, se: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return null;
  const utc = Date.UTC(y, mo - 1, d, h, mi, se);
  const check = new Date(utc);
  // 31 February is not a date.
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return new Date(utc - IST_OFFSET_MS).toISOString();
}

/** A wallet or a transaction hash, or the reason it is neither. */
function subjectOf(raw: string): { input: string; kind: "address" | "tx" } | { reason: string } {
  const s = raw.trim();
  const check = checkAddress(s);
  if (check.valid) return { input: check.address, kind: "address" };
  if (isTxHash(s)) return { input: s, kind: "tx" };
  // Another chain's address is not a typo; say what it is and where it can go.
  const other = identifyChain(s);
  if (other && !other.chain.traceable) {
    return {
      reason: `${other.chain.name} address — FineX traces TRON and Ethereum. Screen it against OFAC from New case.`,
    };
  }
  return { reason: check.reason };
}

/* ------------------------------------------------------------------ parse */

export function parseIntake(raw: string): Intake {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0] ?? "";
  const delimiter = delimiterOf(header);
  const names = splitLine(header, delimiter).map((h) => h.toLowerCase());
  const at = (kind: keyof typeof COLUMN) => names.findIndex((n) => COLUMN[kind].test(n));
  // A sheet needs a wallet-or-transaction column, and a header is words, not an address.
  const subjectCol = at("subject");
  const isSheet =
    lines.length > 1 && subjectCol >= 0 && !names.some((n) => checkAddress(n).valid || isTxHash(n));

  return isSheet ? parseSheet(lines, delimiter, names, subjectCol) : parseList(raw);
}

function parseList(raw: string): Intake {
  const seen = new Set<string>();
  const jobs: IntakeJob[] = [];
  const rejected: IntakeRejected[] = [];
  for (const token of raw.split(/[\s,;]+/)) {
    const candidate = token.trim();
    if (!candidate) continue;
    const subject = subjectOf(candidate);
    if ("reason" in subject) {
      rejected.push({ line: candidate, reason: subject.reason });
      continue;
    }
    // One entry per wallet: an Ethereum address typed in two cases is one wallet.
    const key = `in:${subject.input.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push({ key, ...subject });
  }
  return { jobs, rejected, sheet: false };
}

function parseSheet(lines: string[], delimiter: string, names: string[], subjectCol: number): Intake {
  const col = (re: RegExp) => names.findIndex((n, i) => i !== subjectCol && re.test(n));
  const ackCol = col(COLUMN.ack);
  const amountCol = col(COLUMN.amount);
  const dateCol = col(COLUMN.date);
  const stateCol = col(COLUMN.state);
  const jobs: IntakeJob[] = [];
  const rejected: IntakeRejected[] = [];
  const seen = new Set<string>();

  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delimiter);
    const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const subject = subjectOf(get(subjectCol));
    if ("reason" in subject) {
      rejected.push({ line, reason: subject.reason });
      continue;
    }
    const ack = get(ackCol).replace(/\s+/g, "");
    if (ack && !ACK.test(ack)) {
      rejected.push({ line, reason: "The acknowledgement number has characters a document cannot carry." });
      continue;
    }
    const amountText = get(amountCol);
    const amount = amountText ? parseAmount(amountText) : null;
    if (amountText && amount === null) {
      rejected.push({ line, reason: `"${amountText}" is not an amount in USDT.` });
      continue;
    }
    const dateText = get(dateCol);
    const fraudDate = dateText ? parseDate(dateText) : null;
    if (dateText && fraudDate === null) {
      rejected.push({ line, reason: `"${dateText}" is not a date this sheet can read (use DD-MM-YYYY or YYYY-MM-DD).` });
      continue;
    }
    const stateText = get(stateCol).replace(/\s+/g, " ").slice(0, 60);
    const stateUt = stateText ? (canonicalState(stateText) ?? stateText) : "";
    const key = ack ? `ack:${ack}` : `in:${subject.input.toLowerCase()}`;
    if (seen.has(key)) {
      rejected.push({ line, reason: ack ? "The same acknowledgement number appears twice." : "This wallet is already listed." });
      continue;
    }
    seen.add(key);
    jobs.push({
      key,
      ...subject,
      ...(ack ? { ack } : {}),
      ...(amount !== null ? { amount } : {}),
      ...(fraudDate ? { fraudDate } : {}),
      ...(stateUt ? { stateUt } : {}),
    });
  }
  return { jobs, rejected, sheet: true };
}
