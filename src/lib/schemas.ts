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
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message, path: ['prompt'] });
    switch (q.type) {
      case 'single':
      case 'truefalse':
        if (q.options.length < 2) issue('needs at least 2 options');
        if (q.options.filter((o) => o.correct).length !== 1) issue('needs exactly 1 correct option');
        break;
      case 'multiple':
        if (q.options.length < 2) issue('needs at least 2 options');
        if (q.options.filter((o) => o.correct).length < 1) issue('needs at least 1 correct option');
        break;
      case 'open':
        if (q.acceptedAnswers.length < 1) issue('needs at least 1 accepted answer');
        break;
      case 'number':
        if (q.numberAnswer == null) issue('needs a numeric answer');
        break;
    }
  });

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
]);
export type AdminAction = z.infer<typeof adminActionSchema>;
