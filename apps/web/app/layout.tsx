import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aeta IDE",
  description: "Browser Web IDE with a DeepSeek-powered AI coding agent"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
