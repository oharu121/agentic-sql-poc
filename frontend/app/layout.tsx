import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic SQL Demo",
  description: "Educational text-to-SQL pipeline with live visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
