import Navbar from "@/components/Navbar";

export default function InvestigatePage() {
  return (
    <main className="min-h-screen bg-[#080b14] text-white">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 py-12">

        {/* Page Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
            New Investigation
          </p>

          <h2 className="mt-3 text-3xl font-bold md:text-4xl">
            Analyze a Wallet
          </h2>

          <p className="mt-3 max-w-2xl text-gray-500">
            Enter a wallet address reported by the victim to begin blockchain
            analysis and fund-flow tracing.
          </p>
        </div>

        {/* Wallet Input */}
        <div className="rounded-2xl border border-white/10 bg-[#0d111c] p-6 md:p-8">
          <label className="text-sm font-medium text-gray-300">
            Suspect Wallet Address
          </label>

          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              placeholder="0x..."
              className="flex-1 rounded-xl border border-white/10 bg-[#080b14] px-4 py-4 text-sm text-white outline-none placeholder:text-gray-600 focus:border-cyan-400/50"
            />

            <button className="rounded-xl bg-cyan-400 px-7 py-4 font-semibold text-black transition hover:bg-cyan-300">
              Analyze Wallet
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-600">
            Supported network: Ethereum / EVM-compatible chains
          </p>
        </div>

        {/* Statistics */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Risk Score", "--", "Awaiting analysis"],
            ["Transactions", "--", "Blockchain activity"],
            ["Funds Traced", "--", "Total movement"],
            ["Attribution", "--", "VASP confidence"],
          ].map(([title, value, description]) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-[#0d111c] p-6"
            >
              <p className="text-sm text-gray-500">
                {title}
              </p>

              <p className="mt-3 text-3xl font-bold text-gray-300">
                {value}
              </p>

              <p className="mt-2 text-xs text-gray-600">
                {description}
              </p>
            </div>
          ))}
        </div>

        {/* Fund Flow */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0d111c] p-6 md:p-8">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                Fund Flow
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Transaction movement will appear here after analysis.
              </p>
            </div>

            <span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs text-gray-500">
              No data
            </span>
          </div>

          <div className="mt-8 flex min-h-48 items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-sm text-gray-600">
              Wallet → Intermediaries → VASP / Exchange
            </p>
          </div>
        </div>
      </section>
    </main>
  );
} 