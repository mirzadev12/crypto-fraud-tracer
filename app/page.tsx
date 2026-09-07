import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080b14] text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="mx-auto flex min-h-[75vh] max-w-7xl items-center px-6 py-20">
        <div className="max-w-4xl">

          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            REAL-TIME BLOCKCHAIN INVESTIGATION
          </div>

          {/* Heading */}
          <h2 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Trace the money.
            <br />
            <span className="text-cyan-400">Expose the flow.</span>
          </h2>

          {/* Description */}
          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-400">
            A blockchain intelligence platform that helps investigators trace
            cryptocurrency fraud, analyze fund movement, and identify likely
            exchange destinations.
          </p>

          {/* Buttons */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/investigate"
              className="rounded-xl bg-cyan-400 px-7 py-3.5 text-center font-semibold text-black transition hover:bg-cyan-300"
            >
              Start Investigation →
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 px-7 py-3.5 text-center font-semibold text-gray-300 transition hover:bg-white/5"
            >
              Explore Platform
            </Link>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-16">

          <p className="mb-8 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
            Investigation Workflow
          </p>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["01", "Report", "Victim-reported wallet"],
              ["02", "Trace", "Follow fund movement"],
              ["03", "Attribute", "Identify likely VASP"],
              ["04", "Analyze", "Generate risk intelligence"],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-2xl border border-white/10 bg-[#0d111c] p-6"
              >
                <span className="text-sm text-cyan-400">
                  {number}
                </span>

                <h3 className="mt-4 text-lg font-semibold">
                  {title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}