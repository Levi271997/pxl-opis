import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Office from '@/components/Office';
import { INVITE_COOKIE } from '@/lib/supabase/invite';
import { getAccount, loadOffice } from '@/lib/supabase/server';

export default async function Home({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const account = await getAccount(); // null in demo mode

  // Signed in with an invite still pending: go accept it first.
  const invite = account && (await cookies()).get(INVITE_COOKIE)?.value;
  if (invite) redirect(`/join/${invite}`);

  const office = account ? await loadOffice(account) : null;
  const { notice } = await searchParams;
  return <Office account={account} office={office} notice={notice?.slice(0, 200) ?? null} />;
}
