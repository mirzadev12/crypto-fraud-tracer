import Navbar from "@/components/Navbar";

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-[#080b14] text-white">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
          Investigation Records
        </p>

        <h1 className="mt-3 text-3xl font-bold md:text-4xl">
          Investigation Reports
        </h1>

        <p className="mt-3 text-gray-500">
          Review and export blockchain investigation results.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-[#0d111c] p-8">
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-white/10">
            <p className="text-sm text-gray-600">
              Generated investigation reports will appear here.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}