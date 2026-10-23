"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type User } from "@/lib/api";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<User>("/api/auth/me")
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setReady(true));
  }, [router]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          <span className="text-sm">Authenticating…</span>
        </div>
      </div>
    );
  }

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-white group-hover:text-sky-300 transition">
                  Pipeline Hub
                </span>
                <span className="block text-[10px] text-slate-500 font-mono -mt-1">CI/CD Telemetry</span>
              </div>
            </Link>
            <nav className="flex gap-2 text-xs">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                    pathname === item.href
                      ? "bg-slate-800 text-sky-400"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3.5 text-xs">
            <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 py-1 pl-1.5 pr-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white uppercase">
                {user.email.slice(0, 2)}
              </div>
              <span className="text-slate-300 font-medium">{user.email}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 font-medium text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-rose-400 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
