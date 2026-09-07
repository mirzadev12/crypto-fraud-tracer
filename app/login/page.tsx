import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080b14] px-6 text-white">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/">
            <h1 className="text-2xl font-bold tracking-wide">
              TRACE<span className="text-cyan-400">X</span>
            </h1>
          </Link>

          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gray-500">
            Blockchain Intelligence
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0d111c] p-6 shadow-2xl sm:p-8">

          {/* Heading */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
              Secure Access
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              Investigator Login
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Sign in to access the blockchain investigation console.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-5">

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Investigator ID / Email
              </label>

              <input
                id="email"
                type="email"
                placeholder="investigator@example.com"
                className="w-full rounded-xl border border-white/10 bg-[#080b14] px-4 py-3.5 text-sm text-white outline-none placeholder:text-gray-600 transition focus:border-cyan-400/50"
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-300"
                >
                  Password
                </label>

                <button
                  type="button"
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  Forgot password?
                </button>
              </div>

              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                className="w-full rounded-xl border border-white/10 bg-[#080b14] px-4 py-3.5 text-sm text-white outline-none placeholder:text-gray-600 transition focus:border-cyan-400/50"
              />
            </div>

            {/* Remember */}
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-[#080b14] accent-cyan-400"
              />

              <label
                htmlFor="remember"
                className="text-sm text-gray-500"
              >
                Remember this device
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full rounded-xl bg-cyan-400 px-6 py-3.5 font-semibold text-black transition hover:bg-cyan-300"
            >
              Sign In →
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-center text-xs leading-5 text-gray-600">
              Authorized investigators only. All investigation activity may be
              logged for security and audit purposes.
            </p>
          </div>
        </div>

        {/* Back */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 transition hover:text-white"
          >
            ← Back to Overview
          </Link>
        </div>

      </div>
    </main>
  );
}