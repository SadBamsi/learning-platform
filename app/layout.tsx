import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Interview Prep — Fullstack" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <header className="site">
          <Link href="/">🎯 Interview Prep · Fullstack</Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
