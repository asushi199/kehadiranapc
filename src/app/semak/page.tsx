import type { Metadata } from 'next';

import { SemakExperience } from '@/components/public/semak-experience';

export const metadata: Metadata = {
  title: 'Semak Kehadiran | APC 2025',
  description: 'Semak maklumat penerima APC 2025 dan sahkan kehadiran anda.',
};

export default function SemakPage() {
  return <SemakExperience />;
}
