import { ImageResponse } from "next/og";

/**
 * The tab icon: the interface's own tick mark, a brass lozenge on the
 * near-black ground. It replaces the starter-template favicon the project was
 * generated with, which put the framework's logo in an investigator's tab.
 * Generated at build time, so there is no binary to keep in step with the
 * palette in `app/globals.css`.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
            width: 17,
            height: 17,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #c6a15b",
            transform: "rotate(45deg)",
          }}
        >
          <div style={{ width: 5, height: 5, background: "#c6a15b" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
