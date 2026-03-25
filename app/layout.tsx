import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Figma → Markdown | AI Build Spec Generator",
  description:
    "Extract your entire Figma design into a structured markdown specification ready to drop into any AI to build the full product.",
  keywords: [
    "figma",
    "markdown",
    "ai",
    "design",
    "specification",
    "vercel",
  ],
  authors: [{ name: "AutoSpec Team" }],
  openGraph: {
    title: "Figma → Markdown | AI Build Spec Generator",
    description:
      "Convert Figma designs to AI-ready markdown specifications",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
