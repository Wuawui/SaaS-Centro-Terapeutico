import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "SaaSYB Centro Terapéuticos",
  description:
    "Plataforma SaaS de élite para digitalizar y optimizar la operación completa de centros terapéuticos",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CentroYB",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable}`}>
      <body className="antialiased font-sans text-[#4A5568] bg-[#FDFDFD]">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}