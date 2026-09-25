import AddressChip from "./AddressChip";
import { Designation } from "./ui";

/**
 * The Ethereum attributions checked against a second behaviour: who paid the
 * gas. A deposit address cannot move its USDT without ETH, and an exchange
 * sends that ETH from wallets the explorer tags. So for every address our
 * sweep rule found, the explorer's tag on its gas payer either names the same
 * exchange (agrees), names someone else's gas or custody wallet (conflicts —
 * the method's known failure), or says nothing. Both signals lean on explorer
 * tags; what makes the second independent is the direction: a wallet that
 * settles to an exchange sends it money, but does not get its gas from it.
 *
 * Measured by `scripts/calibrate-clustering-eth.mjs`. Conflicts are listed in
 * full, not counted away: each is an address a trace would call a "likely"
 * deposit address that someone else may manage.
 */

export interface GasPayer {
  tested: number;
  readable: number;
  agrees: number;
  conflicts: number;
  noSignal: number;
  perExchange: Array<{ exchange: string; tested: number; agrees: number; conflicts: number }>;
  conflicting: Array<{ address: string; exchange: string; payer?: string; tags?: string }>;
}

export default function GasPayerCheck({
  data,
  confidenceOf,
}: {
  data: GasPayer;
  /** Each derived row's confidence, by lower-case address, to print beside a conflict. */
  confidenceOf: Record<string, number>;
}) {
  const topBand = data.conflicting.some((c) => (confidenceOf[c.address.toLowerCase()] ?? 0) >= 0.9);
  return (
    <div className="mt-10 grid gap-10 border-t border-line pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <Designation>Independent check · who paid the gas</Designation>
        <p className="mt-4 font-mono text-5xl font-light tabular-nums text-ink">
          {data.agrees}
          <span className="text-faint">/{data.readable}</span>
        </p>
        <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
          Of {data.readable} addresses found by the sweep rule alone, {data.agrees} had their gas
          paid by a wallet the explorer tags as the same exchange. That is a second signal,
          independent of the sweeps: a wallet that merely settles to an exchange sends it money,
          but does not get its gas from it.
        </p>
        <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
          {data.noSignal} carry no tagged payer either way, which neither confirms nor contradicts
          them. Addresses found through an exchange&rsquo;s own gas wallet are not tested here:
          that wallet is how they were found.
        </p>
      </div>
      <div className="min-w-0">
        <Designation>By exchange</Designation>
        <ul className="mt-4 space-y-4">
          {data.perExchange.map((e) => (
            <li key={e.exchange} className="flex items-center gap-4">
              <span className="w-24 shrink-0 truncate text-xs text-faint">{e.exchange}</span>
              <span className="h-[6px] min-w-0 flex-1 bg-surface-2">
                <span
                  className="block h-full bg-brass-dim"
                  style={{ width: `${e.tested ? (e.agrees / e.tested) * 100 : 0}%` }}
                />
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-ink">
                {e.agrees}/{e.tested}
              </span>
            </li>
          ))}
        </ul>
        {data.conflicts ? (
          <div className="mt-6 border-l-2 border-suspicious pl-6">
            <Designation className="!text-suspicious">
              {data.conflicts === 1 ? "One conflict" : `${data.conflicts} conflicts`}
            </Designation>
            <p className="mt-4 text-sm leading-6 text-muted">
              Gas paid by another entity&rsquo;s gas or custody wallet: someone else may manage{" "}
              {data.conflicts === 1 ? "this address" : "these addresses"}, the method&rsquo;s known
              failure. {data.conflicts === 1 ? "It stays" : "They stay"} in the register as derived,
              with this beside {data.conflicts === 1 ? "it" : "them"}; read a trace that ends at one
              with that in mind.
            </p>
            {topBand ? (
              <p className="mt-4 text-sm leading-6 text-muted">
                A conflict sits in the top confidence band: the figure counts sweep evidence,
                and says nothing about who manages an address.
              </p>
            ) : null}
            <ul className="mt-4 space-y-4">
              {data.conflicting.map((c) => (
                <li key={c.address} className="min-w-0 text-xs leading-6">
                  <AddressChip address={c.address} full />
                  <span className="block text-muted">
                    Derived as {c.exchange}
                    {confidenceOf[c.address.toLowerCase()] !== undefined
                      ? ` at confidence ${confidenceOf[c.address.toLowerCase()].toFixed(2)}`
                      : ""}{" "}
                    · gas from <span className="text-ink">{c.tags}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-6 text-sm leading-6 text-muted">
            None conflicts: no address had its gas paid by another entity&rsquo;s gas or custody
            wallet.
          </p>
        )}
      </div>
    </div>
  );
}
