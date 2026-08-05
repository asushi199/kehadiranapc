import { LoginForm } from '@/components/admin/login-form';
import { hasStaffAccess } from '@/lib/auth/shared-access';
import { redirect } from 'next/navigation';

export default async function AdminLoginPage() {
  if (await hasStaffAccess()) redirect('/admin/dashboard');

  return (
    <main className="songket-surface flex min-h-screen items-center px-4 py-8 sm:px-6">
      <section className="mx-auto w-full max-w-md border border-apc-gold/65 bg-apc-navy/95 px-6 py-9 shadow-2xl shadow-black/30 sm:px-8">
        <p className="text-center text-xs font-semibold tracking-[0.3em] text-apc-gold">APC 2025</p>
        <h1 className="mt-4 text-center font-display text-4xl text-apc-gold">Portal Pentadbir</h1>
        <p className="mt-4 text-center text-sm leading-6 text-apc-ivory/80">Masukkan kata laluan petugas untuk menguruskan semakan dan kehadiran penerima.</p>
        <LoginForm />
      </section>
    </main>
  );
}
