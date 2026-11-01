import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { getCurrentUser } from '@/server/auth-guards';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <Header user={user} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
