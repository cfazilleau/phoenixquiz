import { getCurrentUser } from '@/server/auth-guards';
import { buildResultsWorkbook } from '@/server/export';
import { isAdminRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isAdminRole(user?.role)) return new Response('Forbidden', { status: 403 });

  const { id } = await params;
  const result = await buildResultsWorkbook(id);
  if (!result) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="quiz-results.xlsx"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
