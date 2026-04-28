import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../src/app/globals.css";

export const metadata: Metadata = {
  title: "namaa-loc portal",
  description: "LOC portal app"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
