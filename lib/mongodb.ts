import mongoose from "mongoose";
import { ServerApiVersion } from "mongodb";

const TULA_MONGODB_URI = process.env.TULA_MONGO_DB;
const TULA_MONGODB_DB_NAME =
  process.env.TULA_MONGO_DB_NAME || process.env.MONGODB_DB_NAME || "tula";

if (!TULA_MONGODB_URI) {
  throw new Error("Missing TULA_MONGO_DB environment variable.");
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var tulaMongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.tulaMongooseCache ?? {
  conn: null,
  promise: null,
};

global.tulaMongooseCache = cache;

export async function connectToDatabase() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(TULA_MONGODB_URI!, {
      dbName: TULA_MONGODB_DB_NAME,
      bufferCommands: false,
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
