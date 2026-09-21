import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encuentro · Horarios en común",
  description: "Encuentra horarios comunes con preferencias visuales y comentarios.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
