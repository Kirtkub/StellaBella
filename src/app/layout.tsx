import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cleo & Leo Bot Dashboard',
  description: 'Statistics dashboard for Cleo & Leo Telegram Bot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
