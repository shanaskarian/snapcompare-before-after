import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapCompare — Before & After Photo Studio",
  description:
    "AI-powered before & after photography for medical aesthetics. Face detection, lighting analysis, and intelligent comparison.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
