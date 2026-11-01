import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * Contract with the FriendlyFire `quiz` cog (database `phoenixquiz`, collection `bot_events`).
 * The app inserts `pending` events; the cog posts them to Discord and updates `status`.
 * Keep this shape in sync with FriendlyFire's DEVELOPMENT.md.
 */
const botEventSchema = new Schema(
  {
    type: { type: String, enum: ['post_results'], required: true },
    sessionId: { type: String, required: true },
    requestedBy: {
      discordId: { type: String, required: true },
      displayName: { type: String, required: true },
    },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'posted', 'failed', 'expired'], default: 'pending' },
    payload: {
      activityTitle: { type: String, required: true },
      endedAt: { type: Date, default: null },
      playerCount: { type: Number, required: true },
      top: {
        type: [
          new Schema(
            { rank: Number, displayName: String, avatarUrl: String, score: Number },
            { _id: false },
          ),
        ],
        default: [],
      },
    },
    error: { type: String, default: null },
    messageUrl: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { versionKey: false },
);
botEventSchema.index({ status: 1, createdAt: 1 });

export type BotEventDoc = InferSchemaType<typeof botEventSchema> & { _id: mongoose.Types.ObjectId };

export const BotEvent: Model<InferSchemaType<typeof botEventSchema>> =
  mongoose.models.BotEvent ?? mongoose.model('BotEvent', botEventSchema, 'bot_events');
