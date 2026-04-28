import type { Metadata } from "next";
import { Nunito_Sans, Poppins, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import AutoRotate from "@/components/AutoRotate";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

// <!-- TODO Phase 3: read from school_settings -->
const systemName = process.env.NEXT_PUBLIC_SYSTEM_NAME || '{{PROGRAM_NAME}}'

export const metadata: Metadata = {
  title: `${systemName} Leaderboard`,
  description: "The Operating System for Islamic School Culture",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunitoSans.variable} ${poppins.variable} ${sourceSans.variable} antialiased`}>
        <AutoRotate />
        {children}
      </body>
    </html>
  );
}
