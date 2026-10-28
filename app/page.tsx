import Office from '@/components/Office';
import { getAccount } from '@/lib/supabase/server';

export default async function Home() {
  const account = await getAccount(); // null in demo mode
  return <Office account={account} />;
}
