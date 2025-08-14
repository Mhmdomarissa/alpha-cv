import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "CV Analyzer - AI-Powered Recruitment Platform",
  description: "Enterprise-grade CV analysis and job matching system with GPT-4 analysis, vector similarity, and detailed scoring breakdowns.",
  keywords: "CV analysis, AI recruitment, job matching, resume screening, HR technology",
  authors: [{ name: "CV Analyzer Team" }],
  robots: "index, follow",
  openGraph: {
    title: "CV Analyzer - AI-Powered Recruitment Platform",
    description: "Enterprise-grade CV analysis and job matching system with GPT-4 analysis, vector similarity, and detailed scoring breakdowns.",
    type: "website",
    locale: "en_US",
    siteName: "CV Analyzer",
  },
  twitter: {
    card: "summary_large_image",
    title: "CV Analyzer - AI-Powered Recruitment Platform",
    description: "Enterprise-grade CV analysis and job matching system with GPT-4 analysis, vector similarity, and detailed scoring breakdowns.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}