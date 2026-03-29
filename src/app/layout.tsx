import type { Metadata } from 'next';
import { Inter, DotGothic16, Space_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const dotGothic = DotGothic16({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-dot',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'LifeStrat — Personal AI Life Strategy Assistant',
  description: 'Plan your life, career, and time with AI-powered insights.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${dotGothic.variable} ${spaceMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
