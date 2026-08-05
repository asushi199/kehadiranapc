import { redirect } from 'next/navigation';

export default async function CounterPage({ params }: { params: Promise<{ counterNo: string }> }) {
  const { counterNo } = await params;
  const number = Number(counterNo);
  if (!Number.isInteger(number) || number < 1 || number > 6) redirect('/admin/dashboard');
  redirect(`/admin/dashboard?counter=${number}`);
}
