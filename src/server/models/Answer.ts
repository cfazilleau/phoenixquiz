import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const answerSchema = new Schema({
  sessionId: { type: String, required: true },
  questionId: { type: String, required: true },
  userId: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  submittedAt: { type: Date, required: true },
  correct: { type: Boolean, default: null },
  pointsAwarded: { type: Number, default: 0 },
  overriddenBy: { type: String, default: null },
});
answerSchema.index({ sessionId: 1, questionId: 1, userId: 1 }, { unique: true });

export type AnswerDoc = InferSchemaType<typeof answerSchema> & { _id: mongoose.Types.ObjectId };

export const Answer: Model<InferSchemaType<typeof answerSchema>> =
  mongoose.models.Answer ?? mongoose.model('Answer', answerSchema, 'answers');
