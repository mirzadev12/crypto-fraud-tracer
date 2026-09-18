import { ImageResponse } from "next/og";

/** The same lozenge as `icon.tsx`, at the size a phone's home screen asks for. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "8px solid #c6a15b",
            transform: "rotate(45deg)",
          }}
        >
          <div style={{ width: 26, height: 26, background: "#c6a15b" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
