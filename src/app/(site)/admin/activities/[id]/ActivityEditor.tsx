'use client';

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, Copy, GripVertical, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { newId, newQuestion } from '@/components/question-types/defaults';
import { QuestionEditor } from '@/components/question-types/QuestionEditor';
import { Badge, Button, Card, Input, Label, Textarea } from '@/components/ui';
import type { ActivityData } from '@/server/activities';
import { QUESTION_TYPES, type Question } from '@/lib/types';
import { saveActivityAction, startSessionAction } from '../../actions';

export function ActivityEditor({ initial }: { initial: ActivityData }) {
  const t = useTranslations('editor');
  const tt = useTranslations('questionTypes');
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [questions, setQuestions] = useState<Question[]>(initial.questions);
  const [open, setOpen] = useState<string | null>(initial.questions[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const touch = () => {
    setDirty(true);
    setStatus(null);
  };
  const updateQuestion = (q: Question) => {
    setQuestions((qs) => qs.map((x) => (x.id === q.id ? q : x)));
    touch();
  };
  const addQuestion = (type: Question['type']) => {
    const q = newQuestion(type);
    setQuestions((qs) => [...qs, q]);
    setOpen(q.id);
    touch();
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setQuestions((qs) => {
      const from = qs.findIndex((q) => q.id === e.active.id);
      const to = qs.findIndex((q) => q.id === e.over!.id);
      return arrayMove(qs, from, to);
    });
    touch();
  };

  const save = () =>
    startSaving(async () => {
      const res = await saveActivityAction(initial.id, {
        title,
        description,
        questions: questions.map((q) => ({ ...q, imageUrl: q.imageUrl || null })),
      });
      if (res.ok) {
        setDirty(false);
        setStatus({ kind: 'ok', text: t('saved') });
      } else setStatus({ kind: 'error', text: t('saveError', { error: res.error }) });
    });

  return (
    <div className="flex flex-col gap-6 pb-24">
      <Card className="flex flex-col gap-4">
        <div>
          <Label>{t('title')}</Label>
          <Input
            value={title}
            maxLength={120}
            onChange={(e) => {
              setTitle(e.target.value);
              touch();
            }}
            className="text-xl font-bold"
          />
        </div>
        <div>
          <Label>{t('description')}</Label>
          <Textarea
            rows={2}
            value={description}
            maxLength={1000}
            onChange={(e) => {
              setDescription(e.target.value);
              touch();
            }}
          />
        </div>
      </Card>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <SortableQuestion
                key={q.id}
                index={i}
                question={q}
                open={open === q.id}
                onToggle={() => setOpen(open === q.id ? null : q.id)}
                onChange={updateQuestion}
                onDuplicate={() => {
                  const copy = { ...structuredClone(q), id: newId() };
                  setQuestions((qs) => [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)]);
                  setOpen(copy.id);
                  touch();
                }}
                onDelete={() => {
                  if (!confirm(t('confirmDelete'))) return;
                  setQuestions((qs) => qs.filter((x) => x.id !== q.id));
                  touch();
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {questions.length === 0 && <p className="text-center text-muted">{t('noQuestions')}</p>}

      <Card className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-semibold text-muted">{t('addQuestion')}</span>
        {QUESTION_TYPES.map((type) => (
          <Button key={type} variant="secondary" size="sm" onClick={() => addQuestion(type)}>
            + {tt(type)}
          </Button>
        ))}
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
          <form action={startSessionAction}>
            <input type="hidden" name="activityId" value={initial.id} />
            <Button variant="secondary" disabled={dirty || questions.length === 0} title={dirty ? t('saveFirst') : ''}>
              ▶ {t('startSession')}
            </Button>
          </form>
          {dirty && <span className="text-sm text-phoenix-2">{t('unsaved')}</span>}
          {status && (
            <span className={status.kind === 'ok' ? 'text-sm text-emerald-400' : 'text-sm text-red-300'}>{status.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableQuestion(props: {
  index: number;
  question: Question;
  open: boolean;
  onToggle: () => void;
  onChange: (q: Question) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { index, question: q, open } = props;
  const t = useTranslations('editor');
  const tt = useTranslations('questionTypes');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'z-10 opacity-80' : undefined}
    >
      <Card className="p-0">
        <div className="flex items-center gap-2 p-3">
          <button {...attributes} {...listeners} className="cursor-grab text-muted hover:text-white" aria-label={t('drag')}>
            <GripVertical size={18} />
          </button>
          <button onClick={props.onToggle} className="flex flex-1 items-center gap-3 text-left">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="font-mono text-sm text-muted">#{index + 1}</span>
            <Badge>{tt(q.type)}</Badge>
            <span className="line-clamp-1 font-semibold">{q.prompt || <em className="text-muted">{t('untitledQuestion')}</em>}</span>
          </button>
          <span className="text-xs text-muted">
            {q.points} pts · {q.timeLimitSec ? `${q.timeLimitSec}s` : t('manual')}
          </span>
          <button onClick={props.onDuplicate} className="p-1 text-muted hover:text-white" title={t('duplicate')}>
            <Copy size={16} />
          </button>
          <button onClick={props.onDelete} className="p-1 text-muted hover:text-red-300" title={t('delete')}>
            <Trash2 size={16} />
          </button>
        </div>
        {open && (
          <div className="border-t border-line p-4">
            <QuestionEditor question={q} onChange={props.onChange} />
          </div>
        )}
      </Card>
    </div>
  );
}
