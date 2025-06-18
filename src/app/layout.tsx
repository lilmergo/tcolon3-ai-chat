import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from '@/providers/QueryProvider';
import ThemeToggle from "@/components/ui/ThemeToggle";
import {Poppins} from 'next/font/google';

const poppins = Poppins({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
}); 

export const metadata: Metadata = {
  title: 'T:3 AI Chat',
  description: 'AI chat app submission for the T3 Cloneathon.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} antialiased bg-background text-text`}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

