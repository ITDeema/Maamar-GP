import type { Metadata } from "next";
import {
  Noto_Kufi_Arabic,
  Space_Grotesk,
  IBM_Plex_Sans_Arabic,
  IBM_Plex_Sans,
} from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

const kufi = Noto_Kufi_Arabic({ subsets: ["arabic"], variable: "--font-kufi" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const plexAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-plex-ar",
});
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "معمار",
  description: "منصة تحليل المواقع السكنية بالذكاء الاصطناعي",
  icons: {
    icon: "/icon.svg",
  },
  
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${kufi.variable} ${grotesk.variable} ${plexAr.variable} ${plex.variable}`}
    >
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}