"use client";

/**
 * Many victims, one wallet — as a picture.
 *
 * `findLinks` already establishes that several complaints ran through the same
 * account, and the panel states it in words. But the claim this project most
 * wants understood is a *shape*: separate victims, separate complaints, one
 * accountholder at the end. A reader grasps that from a drawing in about two
 * seconds and from a paragraph in about twenty.
 *
 * Drawn the way `BubbleMap` is drawn: hand-made SVG, deterministic layout, no
 * dependency. Colour comes from the same literals as the other canvases — SVG
 * attributes cannot take Tailwind classes, so after any palette change grep
 * this file for `#[0-9a-f]{6}` along with the other two.
 *
 * **It carries no invented data.** Every address and every figure on it comes
 * from traces that were actually run in this session.
 */

import Link from "next/link";
import { shortAddress } from "@/lib/format";
import type { CaseLink } from "@/lib/links";
import { entityPhrase } from "@/lib/voice";

const BRASS = "#c6a15b";
const BRASS_DIM = "#7a6338";
const LINE = "#2a2a28";
const FAINT = "#9a948a";
const INK = "#f0ead8";

const W = 560;
const LEFT_X = 96;
const RIGHT_X = 400;
const ROW = 46;
const PAD = 34;

export default function LinkGraph({ link }: { link: CaseLink }) {
  const n = link.cases.length;
  // Extra room at the foot for the two labels sitting under the shared node.
  const height = Math.max(160, n * ROW + PAD * 2 + 28);
  const midY = height / 2;
  const biggest = Math.max(...link.cases.map((c) => c.taintedValueUsdt), 1);

  return (
    <figure className="mt-6 min-w-0 overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full min-w-[420px]"
        role="img"
        aria-label={`${n} complaints converging on ${link.address}`}
      >
        {link.cases.map((c, i) => {
          const y = PAD + i * ROW + ROW / 2;
          // Thickness is the victim money that reached the shared wallet, so a
          // thick edge is a large loss rather than an arbitrary emphasis.
          const width = 1 + (c.taintedValueUsdt / biggest) * 2.6;
          const midX = (LEFT_X + RIGHT_X) / 2;
          const d = `M ${LEFT_X + 8} ${y} C ${midX} ${y}, ${midX} ${midY}, ${RIGHT_X - 14} ${midY}`;
          return (
            <g key={c.inputAddress}>
              <path
                id={`lk-${i}`}
                d={d}
                fill="none"
                stroke={BRASS_DIM}
                strokeWidth={width}
                opacity={0.75}
              />
              {/* Money travelling the edge, the same device both canvases use.
                  Removed entirely under prefers-reduced-motion by globals.css. */}
              <circle className="fx-packet" r={2.4} fill={BRASS} opacity={0.9}>
                <animateMotion dur={`${3.2 + i * 0.4}s`} repeatCount="indefinite">
                  <mpath href={`#lk-${i}`} />
                </animateMotion>
              </circle>

              <circle cx={LEFT_X} cy={y} r={7} fill="#141414" stroke={FAINT} strokeWidth={1.2} />
              <text
                x={LEFT_X - 16}
                y={y + 4}
                textAnchor="end"
                fill={FAINT}
                className="font-mono"
                fontSize={11}
              >
                {shortAddress(c.inputAddress, 4, 4)}
              </text>
            </g>
          );
        })}

        {/* The shared account. Larger and brass because it is the finding. */}
        <circle cx={RIGHT_X} cy={midY} r={15} fill="#141414" stroke={BRASS} strokeWidth={2} />
        <circle cx={RIGHT_X} cy={midY} r={5} fill={BRASS} />
        {/* Centred beneath the node rather than beside it: an entity phrase set
            to the right runs straight out of the viewBox and is clipped. */}
        <text
          x={RIGHT_X}
          y={midY + 34}
          textAnchor="middle"
          fill={INK}
          className="font-mono"
          fontSize={12}
        >
          {shortAddress(link.address, 6, 5)}
        </text>
        <text x={RIGHT_X} y={midY + 50} textAnchor="middle" fill={FAINT} fontSize={10}>
          {link.label ? entityPhrase(link.label) : "Unlabelled wallet"}
        </text>

        <line
          x1={LEFT_X - 72}
          y1={height - 14}
          x2={W - 20}
          y2={height - 14}
          stroke={LINE}
          strokeWidth={1}
        />
        <text x={LEFT_X - 72} y={height - 20} fill={FAINT} fontSize={10}>
          {n} complaints
        </text>
        <text x={W - 20} y={height - 20} textAnchor="end" fill={FAINT} fontSize={10}>
          one account
        </text>
      </svg>
      <figcaption className="sr-only">
        {n} separate complaints whose funds reached {link.address}.
      </figcaption>
      <div className="mt-4 flex flex-wrap gap-2">
        {link.cases.map((c) => (
          <Link
            key={c.inputAddress}
            href={`/trace/${encodeURIComponent(c.inputAddress)}`}
            className="fx-option inline-block px-3 py-2 font-mono text-xs text-faint transition hover:text-brass"
          >
            {shortAddress(c.inputAddress)}
          </Link>
        ))}
      </div>
    </figure>
  );
}
