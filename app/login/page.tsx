import type { Metadata } from 'next';
import LoginCard from '@/components/LoginCard';
import { supabaseConfigured } from '@/lib/supabase/config';

export const metadata: Metadata = { title: 'Sign in · Pxl Opis' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginCard configured={supabaseConfigured} error={error ?? null} />;
}
