/**
 * Reading an explorer's tags on an address. Pure and dependency-free, so a
 * screen can use it without pulling a chain client into the browser.
 */

/** Category tags the explorer adds beside a name; they name nothing on their own. */
const GENERIC_TAG = /^(exchange|hot wallet|cold wallet|deposit address)$/i;

/** The tag to show a reader: the first that names something, not a category. */
export function displayTag(tags: string[]): string | null {
  return tags.find((t) => !GENERIC_TAG.test(t.trim())) ?? tags[0] ?? null;
}

/**
 * The exchange an explorer's tags name, or null. Only an address the explorer
 * files under "Exchange" counts, and the name is the part of a tag before a
 * colon ("Binance: Hot Wallet") or the tag less a trailing number ("Binance 12").
 */
export function exchangeFromTags(tags: string[]): string | null {
  if (!tags.some((t) => /^exchange$/i.test(t.trim()))) return null;
  for (const tag of tags) {
    const t = tag.trim();
    if (GENERIC_TAG.test(t)) continue;
    const name = (t.includes(":") ? t.slice(0, t.indexOf(":")) : t.replace(/\s+\d+$/, "")).trim();
    if (name) return name;
  }
  return null;
}
