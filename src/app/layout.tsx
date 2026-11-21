import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "@/styles/globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-poppins",
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
  applicationName: "Trailhead Simplified Content Co-pilot",
  title: {
    default: "Trailhead Simplified Content Co-pilot",
    template: "%s · Trailhead Simplified",
  },
  description: "A daily content workspace for Trailhead Simplified.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trailhead Simplified",
  },
  icons: {
    icon: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B111D",
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
        className={`${poppins.variable} ${inter.variable} ${jetBrainsMono.variable}`}
      >
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
