import Navbar from "@/components/Navbar";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#080b14] text-white">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
          Overview
        </p>

        <h1 className="mt-3 text-3xl font-bold md:text-4xl">
          Investigation Dashboard
        </h1>

        <p className="mt-3 text-gray-500">
          Monitor wallet activity, risk indicators and fund movement.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Active Investigations", "12"],
            ["High Risk Wallets", "08"],
            ["Funds Traced", "24.8 ETH"],
            ["VASP Matches", "05"],
          ].map(([title, value]) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-[#0d111c] p-6"
            >
              <p className="text-sm text-gray-500">
                {title}
              </p>

              <p className="mt-3 text-3xl font-bold">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0d111c] p-8">
          <h2 className="text-lg font-semibold">
            Recent Investigations
          </h2>

          <div className="mt-8 flex min-h-48 items-center justify-center rounded-xl border border-dashed border-white/10">
            <p className="text-sm text-gray-600">
              Investigation data will appear here.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}