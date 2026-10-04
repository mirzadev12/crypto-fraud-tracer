import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import CopyButton from "@/components/CopyButton";
import { PageHeader, Panel, SectionHeader } from "@/components/ui";
import spec from "@/public/openapi.json";

export const metadata: Metadata = {
  title: "API for integrators",
  description:
    "Every FineX endpoint, from the OpenAPI 3.1 specification at /openapi.json, with a working curl example for each.",
};

/*
 * Rendered from public/openapi.json — the one description of the API — so the
 * page and the machine-readable spec can never disagree. An integrator at NCRP,
 * SAHYOG or a state cyber cell reads this page; their tooling reads the JSON.
 */

type Param = { name?: string; in?: string; required?: boolean; description?: string; $ref?: string };
type Operation = {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: Param[];
  requestBody?: unknown;
};

const BASE = spec.servers[0].url;
const SAMPLE: Record<string, string> = {
  address: "TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ",
  hash: "<transaction hash>",
};
const REFS = spec.components.parameters as Record<string, Param>;

function resolve(p: Param): Param {
  if (!p.$ref) return p;
  return REFS[p.$ref.split("/").pop() ?? ""] ?? p;
}

function curl(method: string, path: string): string {
  const url = BASE + path.replace(/\{(\w+)\}/g, (_, k: string) => SAMPLE[k] ?? `<${k}>`);
  if (method === "post" && path === "/api/trace") {
    return `curl -X POST ${BASE}/api/trace -H "content-type: application/json" -d '{"address":"${SAMPLE.address}"}'`;
  }
  if (method === "get") return `curl ${url}`;
  return `curl -X ${method.toUpperCase()} ${url}`;
}

const ops = Object.entries(spec.paths as Record<string, Record<string, Operation>>).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => ({ path, method, op })),
);

export default function DevelopersPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Integration"
        title="API for integrators"
        description={`${ops.length} operations across ${Object.keys(spec.paths).length} routes, described in OpenAPI 3.1. No key is needed; chain-reading routes are rate-limited per client. ${spec.info.description.split(". ").slice(-1)[0]}`}
        actions={
          <a href="/openapi.json" className="fx-option px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-faint hover:text-brass">
            openapi.json
          </a>
        }
      />
      {spec.tags.map((tag, i) => {
        const inTag = ops.filter((o) => o.op.tags?.includes(tag.name));
        if (!inTag.length) return null;
        return (
          <section key={tag.name} className="mt-16">
            <SectionHeader index={String(i + 1).padStart(2, "0")} title={tag.name} />
            <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">{tag.description}</p>
            <div className="mt-6 space-y-6">
              {inTag.map(({ path, method, op }) => {
                const example = curl(method, path);
                const params = (op.parameters ?? []).map(resolve);
                return (
                  <Panel key={`${method} ${path}`} framed={false}>
                    <h3 className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="font-mono text-xs uppercase tracking-[0.16em] text-brass">{method}</span>
                      <span className="font-mono text-sm text-ink wrap-anywhere">{path}</span>
                    </h3>
                    <p className="mt-2 text-sm text-ink">{op.summary}</p>
                    {op.description ? (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{op.description}</p>
                    ) : null}
                    {params.length ? (
                      <dl className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[10rem_1fr]">
                        {params.map((p) => (
                          <div key={`${p.in}-${p.name}`} className="contents">
                            <dt className="font-mono text-ink">
                              {p.name}
                              <span className="ml-2 text-faint">{p.in}{p.required ? " · required" : ""}</span>
                            </dt>
                            <dd className="text-faint">{p.description ?? ""}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    <div className="mt-4 flex min-w-0 items-start gap-2 border border-line bg-surface p-4">
                      <code className="min-w-0 flex-1 font-mono text-xs leading-5 text-muted wrap-anywhere">{example}</code>
                      <CopyButton value={example} label="Copy" />
                    </div>
                  </Panel>
                );
              })}
            </div>
          </section>
        );
      })}
    </AppShell>
  );
}
