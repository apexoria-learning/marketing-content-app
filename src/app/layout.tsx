import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "@/styles/globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  applicationName: "Apexoria Content Co-pilot",
  title: {
    default: "Apexoria Content Co-pilot",
    template: "%s · Apexoria",
  },
  description: "A daily content workspace for Apexoria Learning.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Apexoria",
  },
  icons: {
    icon: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable}`}
      >
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
