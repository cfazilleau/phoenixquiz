import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { questionSchema } from './Activity';

const playerSchema = new Schema(
  {
    userId: { type: String, required: true },
    discordId: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String, required: true },
    score: { type: Number, default: 0 },
    kicked: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const sessionSchema = new Schema(
  {
    /** null for live sessions started without a prepared activity. */
    activityId: { type: String, default: null },
    title: { type: String, required: true },
    activitySnapshot: { type: [questionSchema], default: [] },
    joinCode: { type: String, required: true, unique: true },
    presenterToken: { type: String, required: true },
    createdBy: { type: String, required: true },
    status: {
      type: String,
      enum: ['lobby', 'question', 'closed', 'reveal', 'leaderboard', 'ended'],
      default: 'lobby',
    },
    currentIndex: { type: Number, default: 0 },
    deadline: { type: Date, default: null },
    players: { type: [playerSchema], default: [] },
    scoreAdjustments: {
      type: [
        new Schema(
          {
            userId: String,
            delta: Number,
            reason: String,
            by: String,
            at: Date,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    buzzEvents: {
      type: [new Schema({ questionId: String, userId: String, at: Date }, { _id: false })],
      default: [],
    },
    buzzer: {
      locked: { type: Boolean, default: false },
      winnerId: { type: String, default: null },
      order: { type: [new Schema({ userId: String, at: Date }, { _id: false })], default: [] },
      lockedOut: { type: [String], default: [] },
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: mongoose.Types.ObjectId };

export const Session: Model<InferSchemaType<typeof sessionSchema>> =
  mongoose.models.Session ?? mongoose.model('Session', sessionSchema, 'sessions');
