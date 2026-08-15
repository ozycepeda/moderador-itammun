import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { LanguageProvider } from "./components/LanguageProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Moderador · ITAMMUN",
  description: "Consola abierta para conducir los comités de ITAMMUN.",
  applicationName: "Moderador ITAMMUN",
  icons: { icon: "/favicon.svg", apple: "/icon-192.png" },
  openGraph: {
    title: "Moderador · ITAMMUN",
    description: "Consola local para conducir comités y debates de ITAMMUN.",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Sala de debate de ITAMMUN" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className={`${inter.variable} ${playfair.variable}`}><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
