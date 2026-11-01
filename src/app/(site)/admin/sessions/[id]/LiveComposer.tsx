'use client';

import { Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { newQuestion } from '@/components/question-types/defaults';
import { QuestionEditor } from '@/components/question-types/QuestionEditor';
import { Button, Card } from '@/components/ui';
import { questionIssueKey, questionSchema, type AdminAction } from '@/lib/schemas';
import { QUESTION_TYPES, type Question, type QuestionType, type SessionStatus } from '@/lib/types';
import type { ActionResult } from '@/lib/useGame';

/** Write a question during the game, then launch it right away or queue it as the next one. */
export function LiveComposer({
  status,
  act,
}: {
  status: SessionStatus;
  act: (a: AdminAction) => Promise<ActionResult>;
}) {
  const t = useTranslations('control.live');
  const tt = useTranslations('questionTypes');
  const te = useTranslations('editor');
  const [draft, setDraft] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (type: QuestionType) => {
    setDraft(newQuestion(type));
    setError(null);
  };

  const submit = async (launch: boolean) => {
    if (!draft) return;
    const parsed = questionSchema.safeParse(draft);
    if (!parsed.success) {
      setError(te(`issues.${questionIssueKey(parsed.error.issues[0])}`));
      return;
    }
    setBusy(true);
    const res = await act({ type: 'addQuestion', question: parsed.data, launch });
    setBusy(false);
    if (res.ok) {
      setDraft(null);
      setError(null);
    }
  };

  return (
    <Card className="flex flex-col gap-4 border-phoenix/40">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto flex items-center gap-2 text-lg font-bold">
          <Zap size={18} className="text-phoenix-2" /> {t('title')}
        </h3>
        {QUESTION_TYPES.map((type) => (
          <Button
            key={type}
            size="sm"
            variant={draft?.type === type ? 'primary' : 'secondary'}
            onClick={() => pick(type)}
          >
            {tt(type)}
          </Button>
        ))}
      </div>

      {!draft && <p className="text-sm text-muted">{t('hint')}</p>}

      {draft && (
        <>
          <QuestionEditor question={draft} onChange={setDraft} />
          {error && <p className="text-sm text-red-300">{t('invalid', { error })}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => submit(true)} disabled={busy}>
              ▶ {t('launch')}
            </Button>
            <Button variant="secondary" onClick={() => submit(false)} disabled={busy}>
              {status === 'lobby' ? t('queueLobby') : t('queueNext')}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
              {t('discard')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
