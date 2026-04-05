// src/app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

const inter = localFont({
  src: "../assets/fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: "KYNFLOW - Smart Inventory Management Software | KYNSTACK",
  description:
    "KYNFLOW by KYNSTACK is a modern inventory, billing, and business operations platform built to manage stock, suppliers, sales, purchases, and reporting with speed and precision.",
  keywords: [
    "KYNFLOW",
    "KYNSTACK",
    "inventory management software",
    "billing software",
    "stock management system",
    "purchase management",
    "sales management",
    "supplier management",
    "desktop inventory software",
    "POS software",
    "business operations software",
  ],
  authors: [{ name: "Krishna Kumar P S" }],
  creator: "Krishna Kumar P S",
  publisher: "KYNSTACK",
  openGraph: {
    title: "KYNFLOW - Smart Inventory Management Software",
    description:
      "KYNFLOW by KYNSTACK helps businesses manage inventory, billing, suppliers, purchases, sales, and reports in one powerful platform.",
    url: "https://kynstack.com/",
    siteName: "KYNFLOW",
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="h-full antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
