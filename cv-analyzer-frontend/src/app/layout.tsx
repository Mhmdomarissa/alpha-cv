import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthInitializer from "@/components/auth/AuthInitializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CV Analyzer - AI-Powered Resume Matching",
  description: "Advanced CV-JD matching system with explainable AI results",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthInitializer />
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  );
}