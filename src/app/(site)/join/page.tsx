import { getTranslations } from 'next-intl/server';
import { JoinForm } from '@/components/JoinForm';
import { Card } from '@/components/ui';
import { requireUser } from '@/server/auth-guards';

export default async function JoinPage() {
  await requireUser('/join');
  const t = await getTranslations('join');
  return (
    <div className="flex justify-center pt-16">
      <Card className="flex w-full max-w-md flex-col items-center gap-5 p-8 text-center">
        <h1 className="text-3xl font-black">{t('title')}</h1>
        <JoinForm />
      </Card>
    </div>
  );
}
