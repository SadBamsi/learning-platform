import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Learning Platform" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <header className="site">
          <Link href="/">📚 Learning Platform</Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
