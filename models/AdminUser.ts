import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const adminUserSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      default: "",
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      trim: true,
    },
    passwordSalt: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "admin_users",
  },
);

export type AdminUserDocument = InferSchemaType<typeof adminUserSchema>;

const AdminUser =
  (mongoose.models.AdminUser as Model<AdminUserDocument>) ||
  mongoose.model<AdminUserDocument>("AdminUser", adminUserSchema, "admin_users");

export default AdminUser;
