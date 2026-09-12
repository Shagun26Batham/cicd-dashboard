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
        Loading…
      </div>
    );
  }

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[#243049] bg-[#0b1220]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-sm font-semibold tracking-wide">
              Pipeline Hub
            </Link>
            <nav className="flex gap-4 text-sm text-slate-400">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={pathname === item.href ? "text-white" : "hover:text-white"}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>{user.email}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-[#243049] px-2.5 py-1 text-slate-200 hover:bg-white/5"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
