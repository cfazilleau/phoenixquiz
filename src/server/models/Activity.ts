import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { QUESTION_TYPES } from '@/lib/types';

const optionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    correct: { type: Boolean, default: false },
  },
  { _id: false },
);

export const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    prompt: { type: String, required: true },
    imageUrl: { type: String, default: null },
    timeLimitSec: { type: Number, default: null },
    points: { type: Number, default: 100 },
    options: { type: [optionSchema], default: [] },
    acceptedAnswers: { type: [String], default: [] },
    numberAnswer: { type: Number, default: null },
    tolerance: { type: Number, default: null },
  },
  { _id: false },
);

const activitySchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    createdBy: { type: String, required: true },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true },
);

export type ActivityDoc = InferSchemaType<typeof activitySchema> & { _id: mongoose.Types.ObjectId };

export const Activity: Model<InferSchemaType<typeof activitySchema>> =
  mongoose.models.Activity ?? mongoose.model('Activity', activitySchema, 'activities');
