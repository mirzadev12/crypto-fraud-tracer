import Navbar from "@/components/Navbar";

export default function FundFlowPage() {
  return (
    <main className="min-h-screen bg-[#080b14] text-white">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
          Blockchain Analysis
        </p>

        <h1 className="mt-3 text-3xl font-bold md:text-4xl">
          Fund Flow
        </h1>

        <p className="mt-3 text-gray-500">
          Visualize how cryptocurrency moves between wallets.
        </p>

        <div className="mt-10 flex min-h-[500px] items-center justify-center rounded-2xl border border-white/10 bg-[#0d111c]">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-400">
              Fund Flow Graph
            </p>

            <p className="mt-2 text-sm text-gray-600">
              Wallet → Intermediaries → VASP / Exchange
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}