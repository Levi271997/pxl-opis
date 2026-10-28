import Office from '@/components/Office';
import { getAccount, loadOffice } from '@/lib/supabase/server';

export default async function Home() {
  const account = await getAccount(); // null in demo mode
  const office = account ? await loadOffice(account) : null;
  return <Office account={account} office={office} />;
}
