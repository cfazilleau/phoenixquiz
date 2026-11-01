import { z } from 'zod';
import { QUESTION_TYPES } from './types';

const optionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().trim().min(1).max(200),
  correct: z.boolean(),
});

export const questionSchema = z
  .object({
    id: z.string().min(1).max(40),
    type: z.enum(QUESTION_TYPES),
    prompt: z.string().trim().min(1).max(500),
    imageUrl: z.union([z.url().max(1000), z.literal(''), z.null()]).optional(),
    timeLimitSec: z.number().int().min(5).max(600).nullable().optional(),
    points: z.number().int().min(0).max(10000),
    options: z.array(optionSchema).max(8).default([]),
    acceptedAnswers: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    numberAnswer: z.number().finite().nullable().optional(),
    tolerance: z.number().finite().min(0).nullable().optional(),
  })
  .superRefine((q, ctx) => {
    // Messages are QuestionIssue keys, translated by the UI (editor.issues.*).
    const issue = (message: QuestionIssue) => ctx.addIssue({ code: 'custom', message, path: ['type'] });
    switch (q.type) {
      case 'single':
      case 'truefalse':
        if (q.options.length < 2) issue('options_min');
        if (q.options.filter((o) => o.correct).length !== 1) issue('one_correct');
        break;
      case 'multiple':
        if (q.options.length < 2) issue('options_min');
        if (q.options.filter((o) => o.correct).length < 1) issue('some_correct');
        break;
      case 'open':
        if (q.acceptedAnswers.length < 1) issue('accepted_min');
        break;
      case 'number':
        if (q.numberAnswer == null) issue('number_missing');
        break;
    }
  });

export type QuestionIssue =
  | 'prompt_empty'
  | 'option_empty'
  | 'answer_empty'
  | 'image_url'
  | 'time_limit'
  | 'options_min'
  | 'one_correct'
  | 'some_correct'
  | 'accepted_min'
  | 'number_missing'
  | 'title_empty'
  | 'invalid';

/** Maps a validation issue on a question (path relative to the question) to a translatable key. */
export function questionIssueKey(issue: { code: string; message: string; path: PropertyKey[] }): QuestionIssue {
  if (issue.code === 'custom') return issue.message as QuestionIssue;
  switch (issue.path[0]) {
    case 'prompt':
      return 'prompt_empty';
    case 'options':
      return 'option_empty';
    case 'acceptedAnswers':
      return 'answer_empty';
    case 'imageUrl':
      return 'image_url';
    case 'timeLimitSec':
      return 'time_limit';
    case 'title':
      return 'title_empty';
    default:
      return 'invalid';
  }
}

export const activityInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(''),
  questions: z.array(questionSchema).max(200),
});
export type ActivityInput = z.infer<typeof activityInputSchema>;

// ---- Socket payloads ----

export const joinPayloadSchema = z.object({
  code: z.string().trim().toUpperCase().length(6),
  role: z.enum(['player', 'admin', 'presenter']),
  token: z.string().max(100).optional(),
});
export type JoinPayload = z.infer<typeof joinPayloadSchema>;

export const answerPayloadSchema = z.object({
  questionId: z.string().min(1).max(40),
  value: z.union([z.array(z.string().max(40)).max(8), z.string().max(200), z.number().finite()]),
});
export type AnswerPayload = z.infer<typeof answerPayloadSchema>;

export const adminActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('goto'), index: z.number().int().min(0) }),
  z.object({ type: z.literal('close') }),
  z.object({ type: z.literal('reveal') }),
  z.object({ type: z.literal('leaderboard') }),
  z.object({ type: z.literal('end') }),
  z.object({ type: z.literal('kick'), userId: z.string().min(1) }),
  z.object({ type: z.literal('unkick'), userId: z.string().min(1) }),
  z.object({
    type: z.literal('adjustScore'),
    userId: z.string().min(1),
    delta: z.number().int().min(-100000).max(100000),
    reason: z.string().trim().max(200).default(''),
  }),
  z.object({
    type: z.literal('override'),
    questionId: z.string().min(1),
    userId: z.string().min(1),
    correct: z.boolean(),
  }),
  z.object({ type: z.literal('buzzerLock') }),
  z.object({ type: z.literal('buzzerUnlock') }),
  z.object({ type: z.literal('buzzerReset'), lockOutPrevious: z.boolean().default(false) }),
  z.object({ type: z.literal('buzzerJudge'), userId: z.string().min(1), correct: z.boolean() }),
  /** Live authoring: insert a question right after the current one, optionally launching it. */
  z.object({ type: z.literal('addQuestion'), question: questionSchema, launch: z.boolean().default(false) }),
]);
export type AdminAction = z.infer<typeof adminActionSchema>;
