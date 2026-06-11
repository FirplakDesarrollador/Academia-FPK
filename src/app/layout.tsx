import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AuthProvider from "@/components/Providers/AuthProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Academia | Tu Plataforma de Aprendizaje",
  description: "Plataforma de educación online moderna y eficiente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
