import { requireUser } from '@/server/auth-guards';
import { PlayClient } from './PlayClient';

export default async function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const user = await requireUser(`/play/${upper}`);
  return <PlayClient code={upper} userId={user.id} />;
}
