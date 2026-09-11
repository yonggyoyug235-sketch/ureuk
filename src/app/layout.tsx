import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우륵 채팅",
  description: "Next.js + SQLite(libSQL) 채팅 앱",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
