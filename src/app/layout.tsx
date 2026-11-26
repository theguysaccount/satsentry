import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://satsentry.vercel.app"),
  title: "SatSentry — Live Bitcoin & Lightning CVE Radar, Node Auditor & L402 Defense API",
  description:
    "Open-source, non-custodial Bitcoin & Lightning security telemetry. Track real-time mainnet CVE exposure across 21,500+ reachable nodes, audit node stacks & public Lightning posture, and monetize fleet audits via L402 & MCP.",
  openGraph: {
    title: "SatSentry — Bitcoin & Lightning CVE Radar & Node Security Auditor",
    description:
      "Real-time mainnet Bitcoin Core CVE exposure census, Lightning node posture auditor, local port/version CLI, MCP server, and L402 paid fleet API.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased text-[#e6edf3] selection:bg-[#f7931a]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
