import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const userSchema = new Schema(
  {
    discordId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String, required: true },
    isGuildMember: { type: Boolean, default: false },
    role: { type: String, enum: ['superadmin', 'admin', 'player'], default: 'player' },
    lastLoginAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<InferSchemaType<typeof userSchema>> =
  mongoose.models.User ?? mongoose.model('User', userSchema, 'users');
