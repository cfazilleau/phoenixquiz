import mongoose from 'mongoose';

const globalForDb = globalThis as unknown as { __mongoose?: Promise<typeof mongoose> };

/** Shared, lazily-created Mongoose connection (survives dev hot reloads). */
export function connectDb(): Promise<typeof mongoose> {
  if (!globalForDb.__mongoose) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    globalForDb.__mongoose = mongoose
      .connect(uri, { dbName: process.env.MONGODB_DB || 'phoenixquiz' })
      .catch((err) => {
        globalForDb.__mongoose = undefined;
        throw err;
      });
  }
  return globalForDb.__mongoose;
}
