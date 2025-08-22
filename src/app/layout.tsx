// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StoreWise - Smart Inventory Management Software | Averix Solutions",
  description:
    "StoreWise by Averix Solutions is a modern inventory management software designed for businesses of all sizes. Easily manage stock, suppliers, multi-store operations, sales, and reporting in one platform.",
  keywords: [
    "StoreWise",
    "Averix Solutions",
    "inventory management software",
    "stock management system",
    "multi-store inventory",
    "POS system",
    "business software",
    "warehouse tracking",
    "supplier management",
    "inventory SaaS",
  ],
  authors: [{ name: "Krishna Kumar P S" }],
  creator: "Krishna Kumar P S",
  publisher: "Averix Solutions",
  openGraph: {
    title: "StoreWise - Smart Inventory Management Software",
    description:
      "StoreWise by Averix Solutions is a scalable inventory management software to streamline stock, suppliers, and store operations.",
    url: "https://storewise.averixsolutions.com/",
    siteName: "StoreWise",
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
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
