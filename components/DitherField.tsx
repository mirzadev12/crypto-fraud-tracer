"use client";

import { useEffect, useRef } from "react";

/**
 * A 1-bit ordered-dither plate of a block chain.
 *
 * The reference for this is the Bayer-dither shader look, but built from
 * nothing: no dependency, no remote image, no WebGL. The image is generated
 * geometry — a run of blocks, each carrying a header band and hash bars, linked
 * head to tail, with one short fork branching away — thresholded through a real
 * 4×4 Bayer matrix. That is the same ordered dithering the reference uses and
 * the same process a newspaper used to reproduce a photograph in one ink.
 *
 * That is why it belongs here rather than a gradient or a glow: dithering is a
 * printing technique. It reads as an engraved plate, which is the register the
 * rest of this interface is in.
 *
 * Painted once to a canvas at device resolution. Deterministic — the same size
 * always produces the same plate, so it never shimmers between renders.
 */

/** The classic 4×4 ordered-dither threshold matrix, normalised to 0..1. */
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

/* ------------------------------------------------------------- the geometry */

/*
 * All measurements are in units of the plate height, and the horizontal axis is
 * scaled by the aspect ratio, so a block stays square whatever shape the hero
 * happens to be. Everything is a straight edge: no curves, in keeping with the
 * square-cornered geometry the rest of the interface is built from.
 */

const STROKE = 0.009; // line weight
const BLOCK = 0.2; // side of a block on the main chain
const PITCH = 0.34; // centre to centre along the chain
const MAIN_Y = 0.4; // the main chain runs across here
const FORK_Y = 0.75; // the fork runs across here
const FORK_FROM = 1; // the fork leaves this block of the main chain
const FORK_BLOCK = 0.13; // fork blocks are smaller — a shorter, losing branch

/*
 * Densities, and they are a budget as much as the palette is. Brass is spent on
 * the link seals and nothing else, so the plate is an ink engraving with a few
 * struck marks on it rather than a gold drawing.
 */
const V_EDGE = 0.7; // block outline
const V_SEAL = 0.92; // the lozenge struck on each link — the only brass
const V_LINK = 0.68; // the link from one block to the next
const V_HEAD = 0.62; // the rule under a block header
const V_BAND = 0.24; // the header band itself
const V_HASH = 0.44; // hash bars in the body of a block

/** Deterministic 0..1 from an integer — the hash bars must never reshuffle. */
function noise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * What one dither cell resolves to. `inside` damps the background ramp so a
 * block's contents are legible instead of drowning in the ground texture, and
 * `brass` is carried separately from the value so the ink/brass decision is a
 * statement about what a mark *is*, not about how dense it happens to be.
 */
interface Pen {
  v: number;
  brass: boolean;
  inside: boolean;
}

function mark(pen: Pen, value: number, brass = false) {
  if (value > pen.v) {
    pen.v = value;
    pen.brass = brass;
  }
}

/**
 * One block: an outlined square with a header band and three ragged bars under
 * it. The bars are what make it read as a block of records rather than an empty
 * box, and their varying lengths are what make them read as hashes.
 */
function block(
  pen: Pen,
  X: number,
  Y: number,
  cx: number,
  cy: number,
  size: number,
  seed: number,
) {
  const half = size / 2;
  const dx = Math.abs(X - cx);
  const dy = Math.abs(Y - cy);
  if (dx > half || dy > half) return;

  pen.inside = true;

  // Drawn hollow. A filled block saturates the dither into a solid slab, which
  // stops being halftone and starts being a blob.
  if (half - dx < STROKE || half - dy < STROKE) {
    mark(pen, V_EDGE);
    return;
  }

  const top = cy - half;
  const left = cx - half;

  // The header: a lightly dithered band closed by a rule.
  if (Y < top + size * 0.28) {
    mark(pen, Math.abs(Y - (top + size * 0.28)) < STROKE * 0.8 ? V_HEAD : V_BAND);
    return;
  }

  // Three bars of ragged length: the records inside.
  for (let i = 0; i < 3; i++) {
    const barY = top + size * (0.46 + i * 0.18);
    if (Math.abs(Y - barY) < STROKE * 0.8) {
      const run = 0.28 + noise(seed * 7.3 + i) * 0.5;
      const x0 = left + size * 0.14;
      if (X > x0 && X < x0 + size * run) mark(pen, V_HASH);
      return;
    }
  }
}

/** The link between two blocks, with a lozenge seal struck at its midpoint. */
function link(pen: Pen, X: number, Y: number, x0: number, x1: number, y: number) {
  if (X < x0 || X > x1) return;
  const mid = (x0 + x1) / 2;
  // The lozenge is the same rotated square used as a tick mark elsewhere.
  if (Math.abs(X - mid) + Math.abs(Y - y) < 0.022) mark(pen, V_SEAL, true);
  else if (Math.abs(Y - y) < STROKE * 0.8) mark(pen, V_LINK);
}

/** A vertical run — used once, where the fork drops away from the main chain. */
function drop(pen: Pen, X: number, Y: number, x: number, y0: number, y1: number) {
  if (Y < y0 || Y > y1) return;
  if (Math.abs(X - x) < STROKE * 0.8) mark(pen, V_LINK);
}

/** The whole image, as a function. Returns the value and colour of one cell. */
function chainField(px: number, py: number, w: number, h: number): Pen {
  const aspect = w / h;
  const X = (px / w) * aspect;
  const Y = py / h;

  const pen: Pen = { v: 0, brass: false, inside: false };

  // The main chain, marching across the plate until it runs off the edge.
  const first = 0.1 + BLOCK / 2;
  const count = Math.max(2, Math.ceil((aspect - first) / PITCH) + 1);

  for (let i = 0; i < count; i++) {
    const cx = first + i * PITCH;
    block(pen, X, Y, cx, MAIN_Y, BLOCK, i + 1);
    if (i < count - 1) {
      link(pen, X, Y, cx + BLOCK / 2, cx + PITCH - BLOCK / 2, MAIN_Y);
    }
  }

  // One fork: a shorter branch leaving the chain and stopping. Two blocks, and
  // nothing leading on from the second — a branch that did not continue.
  const forkX = first + FORK_FROM * PITCH;
  drop(pen, X, Y, forkX, MAIN_Y + BLOCK / 2, FORK_Y);
  const forkFirst = forkX + 0.17;
  link(pen, X, Y, forkX, forkFirst - FORK_BLOCK / 2, FORK_Y);
  for (let i = 0; i < 2; i++) {
    const cx = forkFirst + i * (FORK_BLOCK + 0.12);
    block(pen, X, Y, cx, FORK_Y, FORK_BLOCK, 40 + i);
    if (i === 0) {
      link(pen, X, Y, cx + FORK_BLOCK / 2, cx + FORK_BLOCK / 2 + 0.12, FORK_Y);
    }
  }

  const u = px / w;
  const t = py / h;

  // Falloff, so the plate dissolves at its edges instead of being cropped.
  const edge =
    Math.min(1, Math.min(u, 1 - u) * 4.5) * Math.min(1, Math.min(t, 1 - t) * 2.8);

  // A sparse ground, kept quieter on the left where the headline sits — and
  // quieter still inside a block, so the block reads as an object holding
  // something rather than a window onto the same noise.
  const ramp = (0.1 + u * 0.05) * (pen.inside ? 0.35 : 1);

  // Capped below 1 so even the densest areas still carry texture.
  pen.v = Math.max(0, Math.min(0.86, (pen.v + ramp) * edge));
  return pen;
}

/* ------------------------------------------------------------ the component */

export default function DitherField({
  gridSize = 2,
  ink = "#f0ead8",
  accent = "#c6a15b",
  opacity = 0.22,
  className = "",
}: {
  /** Size of one dither cell in CSS pixels. Larger reads coarser, more printed. */
  gridSize?: number;
  ink?: string;
  accent?: string;
  opacity?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const paint = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const { width, height } = parent.getBoundingClientRect();
      if (width < 2 || height < 2) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cell = Math.max(1, gridSize) * dpr;
      const cols = Math.ceil(canvas.width / cell);
      const rows = Math.ceil(canvas.height / cell);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const pen = chainField(col, row, cols, rows);
          // The ordered part: the threshold depends on where the cell sits.
          if (pen.v <= BAYER_4X4[row % 4][col % 4]) continue;

          ctx.fillStyle = pen.brass ? accent : ink;
          ctx.fillRect(col * cell, row * cell, cell, cell);
        }
      }
    };

    paint();

    // Repaint on resize so the plate stays crisp, without reacting to every
    // scroll-driven viewport wobble on mobile.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    });
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [gridSize, ink, accent]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ opacity }}
    />
  );
}
