/**
 * Rupee amounts the way an Indian officer reads them: lakh and crore above a
 * lakh, Indian digit grouping (12,34,567) below it. Written by hand rather than
 * through a locale, so the server and every browser print exactly the same
 * string.
 */

const LAKH = 1e5;
const CRORE = 1e7;

/** "1,23,45,678" — the last three digits, then pairs. */
export function groupIndian(n: number): string {
  const whole = Math.round(Math.abs(n)).toString();
  const sign = n < 0 ? "-" : "";
  if (whole.length <= 3) return sign + whole;
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}${rest},${last3}`;
}

/** "₹48,250", "₹3.72 lakh", "₹2.14 crore". Two decimals on lakh and crore. */
export function formatInr(rupees: number): string {
  if (!Number.isFinite(rupees)) return "—";
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? "-" : "";
  if (abs >= CRORE) return `${sign}₹${(abs / CRORE).toFixed(2)} crore`;
  if (abs >= LAKH) return `${sign}₹${(abs / LAKH).toFixed(2)} lakh`;
  return `${sign}₹${groupIndian(abs)}`;
}

/** The rate itself, to the paisa: "₹99.52". */
export function formatRate(rate: number): string {
  return `₹${rate.toFixed(2)}`;
}
