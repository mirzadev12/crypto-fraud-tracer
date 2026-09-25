import { encodeQr } from "@/lib/qr";

/**
 * A QR code drawn as a single SVG path: dark on white, with the standard
 * four-module quiet zone, so it prints at any size without being rasterised.
 * Renders nothing if the text is too long to encode (lib/qr.ts).
 */
export default function QrCode({
  text,
  label,
  className,
}: {
  text: string;
  /** What scanning it opens; read out in place of the picture. */
  label: string;
  className?: string;
}) {
  const qr = encodeQr(text);
  if (!qr) return null;
  const quiet = 4;
  const size = qr.modules.length + quiet * 2;
  let d = "";
  qr.modules.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (!row[x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run]) run++;
      d += `M${x + quiet} ${y + quiet}h${run}v1h-${run}z`;
      x += run;
    }
  });
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={d} fill="#141412" />
    </svg>
  );
}
