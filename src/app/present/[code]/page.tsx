import { PresentClient } from './PresentClient';

export default async function PresentPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { code } = await params;
  const { t } = await searchParams;
  return <PresentClient code={code.toUpperCase()} token={t ?? ''} />;
}
