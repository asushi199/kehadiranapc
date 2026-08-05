import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="songket-surface flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-xl border border-apc-gold/60 bg-apc-navy/95 px-7 py-10 text-center shadow-2xl shadow-black/25 sm:px-12">
        <p className="mb-3 text-xs font-semibold tracking-[0.32em] text-apc-gold">APC 2025</p>
        <h1 className="font-display text-4xl leading-tight text-apc-gold sm:text-5xl">
          Majlis Anugerah Perkhidmatan Cemerlang
        </h1>
        <p className="mx-auto mt-6 max-w-md text-sm leading-6 text-apc-ivory/80">
          Sistem semakan nombor penerima, tempat duduk dan kaunter.
        </p>
        <Link
          className="mt-8 inline-flex min-h-12 items-center justify-center border border-apc-gold bg-apc-gold px-6 text-sm font-bold tracking-wide text-apc-navy transition-colors hover:bg-apc-ivory focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apc-gold"
          href="/semak"
        >
          SEMAK MAKLUMAT
        </Link>
      </section>
    </main>
  );
}
