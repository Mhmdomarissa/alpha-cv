import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthInitializer from "@/components/auth/AuthInitializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Alpha CV - AI-Powered Resume Matching",
  description: "Advanced CV-JD matching system with explainable AI results",
  icons: {
    icon: '/alphadatalogo.svg',
    shortcut: '/alphadatalogo.svg',
    apple: '/alphadatalogo.svg',
  },
};

export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 5 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased overflow-x-hidden`}>
        <AuthInitializer />
        {children}
      </body>
    </html>
  );
}