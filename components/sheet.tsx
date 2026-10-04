/**
 * The pieces every FineX document sheet is built from: the freeze request, the
 * combined request for a batch and the request to the issuer of USDT. One
 * module, so the documents cannot drift apart, and so none of them has to
 * import another to share them. Palette values are literal because the sheet
 * is paper: the app tokens are dark.
 */

export const SHEET = {
  ink: "text-[#141412]",
  body: "text-[#4a4741]",
  faint: "text-[#75726a]",
  rule: "border-[#d9d5cb]",
  ruleSoft: "border-[#e6e2d8]",
};

export function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`fx-print-block mt-10 border-t pt-6 ${SHEET.rule}`}>
      <div className="flex items-baseline gap-4">
        <span className={`font-mono text-xs tracking-[0.2em] ${SHEET.faint}`}>{n}</span>
        <h2 className={`font-document text-xl leading-tight tracking-tight ${SHEET.ink}`}>
          {title}
        </h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className={`font-mono text-xs uppercase tracking-[0.16em] ${SHEET.faint}`}>
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${SHEET.ink}`}>{children}</dd>
    </div>
  );
}

/** A line the issuing officer completes by hand or in the PDF. */
export function Blank({
  label,
  width = "w-full",
  value,
}: {
  label: string;
  width?: string;
  /** Filled in when the tool genuinely knows it, e.g. from a complaint sheet. */
  value?: string;
}) {
  return (
    <div className={width}>
      <div className={`flex h-8 items-end border-b pb-1 font-mono text-sm ${SHEET.rule} ${SHEET.ink}`}>
        {value ?? ""}
      </div>
      <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.16em] ${SHEET.faint}`}>
        {label}
      </p>
    </div>
  );
}
