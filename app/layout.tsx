import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegistration } from "../components/pwa-registration";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "JANASOOCHI",
  title: {
    default: "జనసూచి — JANASOOCHI",
    template: "%s | JANASOOCHI",
  },
  description:
    "Private electoral-roll search, source verification and data-quality workspace for Pallerlamudi Parts 227–230.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/janasoochi-logo-2026-192.png", sizes: "192x192", type: "image/png" },
      { url: "/janasoochi-logo-2026-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/janasoochi-logo-2026-192.png", sizes: "192x192" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "JANASOOCHI",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0b2f56",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-IN" dir="ltr" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <PwaRegistration />
      </body>
    </html>
  );
}

