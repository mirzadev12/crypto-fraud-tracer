"use client";

import { useEffect, useRef } from "react";

/**
 * A 1-bit ordered-dither plate.
 *
 * The reference for this is the Bayer-dither shader look, but built from
 * nothing: no dependency, no remote image, no WebGL. The field is generated
 * geometry — a ledger lattice of linked blocks — thresholded through a real
 * 4×4 Bayer matrix, which is the same ordered-dithering the reference uses and
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

/**
 * The image being dithered, as a function rather than a file: a chain of blocks
 * running on a diagonal, each linked to the next, over a soft falloff. Returns
 * 0..1 luminance.
 */
function ledgerField(x: number, y: number, w: number, h: number): number {
  const u = x / w;
  const v = y / h;

  // A run of blocks along a shallow diagonal — the ledger.
  const along = u * 3.1 + v * 0.9;
  const across = v - u * 0.22 - 0.34;

  const phase = along % 1;
  const insideX = phase > 0.12 && phase < 0.72;
  const insideY = Math.abs(across) < 0.085;

  // Blocks are drawn hollow. A filled block saturates the dither into a solid
  // slab, which stops being halftone and starts being a blob — and spends the
  // brass budget on decoration.
  const edgeX = Math.min(Math.abs(phase - 0.12), Math.abs(phase - 0.72));
  const edgeY = Math.abs(Math.abs(across) - 0.085);
  const onBorder =
    (insideX && insideY && (edgeX < 0.012 || edgeY < 0.006)) ? 0.78 : 0;
  const inField = insideX && insideY ? 0.16 : 0;

  // The link from one block to the next, and a baseline rule under the chain.
  const link = !insideX && Math.abs(across) < 0.014 ? 0.7 : 0;
  const rule = Math.abs(across - 0.2) < 0.004 ? 0.42 : 0;

  // Falloff, so the plate dissolves at its edges instead of being cropped.
  const edge =
    Math.min(1, Math.min(u, 1 - u) * 3.4) * Math.min(1, Math.min(v, 1 - v) * 3);

  // A ramp keeps the background from being a flat 50% field of noise.
  const ramp = 0.3 - u * 0.2 + Math.sin(v * 5.4) * 0.04;

  const value = (Math.max(onBorder, link, rule, inField) + ramp) * edge;
  // Capped below 1 so the densest areas still carry texture.
  return Math.max(0, Math.min(0.86, value));
}

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
          const value = ledgerField(col, row, cols, rows);
          // The ordered part: the threshold depends on where the cell sits.
          const threshold = BAYER_4X4[row % 4][col % 4];
          if (value <= threshold) continue;

          // Brass only where the field is densest — the blocks themselves.
          // Brass only on the structure itself, never on the field.
          ctx.fillStyle = value > 0.79 ? accent : ink;
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
