import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google"; // i want to change this fonts afterward
import "./globals.css";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";

const IBMPlex =IBM_Plex_Sans({
 subsets: ["latin"],
weight:['400','500','600','700'],
variable: '--font-ibm-plex' });

export const metadata: Metadata = {
  title: "Creator",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{
      variables: {colorPrimary: '#E286CC'}
    }}>
    <html lang="en">
      <body className={cn("font-IBMPlex antialiased", IBMPlex.variable)}>{children}</body>
    </html>
    </ClerkProvider>
  );
}