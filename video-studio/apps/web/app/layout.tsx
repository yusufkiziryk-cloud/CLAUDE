import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Video Stüdyosu",
  description: "Yapay zekâ destekli video üretim ve kurgu stüdyosu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen">
        <header className="border-b border-zinc-800 bg-zinc-900">
          <nav
            className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3"
            aria-label="Ana gezinme"
          >
            <Link href="/" className="text-lg font-bold text-indigo-400">
              🎬 AI Video Stüdyosu
            </Link>
            <Link href="/" className="text-sm text-zinc-300 hover:text-white">
              Projeler
            </Link>
            <span className="ml-auto rounded bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-200">
              Faz 3 — anahtarsız modda senaryo üretici şablon taslağıdır (LLM değil)
            </span>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
