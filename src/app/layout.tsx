import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'APC 2025 | Sistem Semak Kehadiran Peserta',
  description: 'Sistem semakan dan pengesahan kehadiran Majlis APC 2025.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ms">
      <body>{children}</body>
    </html>
  );
}
