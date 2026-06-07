import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bubble Diagram Tool",
  description:
    "Create architectural space-planning bubble diagrams from spreadsheets or PDFs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
