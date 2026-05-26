import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const contactSubmissionSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    apartmentType: {
      type: String,
      required: true,
      trim: true,
    },
    budget: {
      type: String,
      required: true,
      trim: true,
    },
    purchaseGoal: {
      type: String,
      default: "",
      trim: true,
    },
    moveInTimeline: {
      type: String,
      default: "",
      trim: true,
    },
    preferredContactTime: {
      type: String,
      default: "",
      trim: true,
    },
    siteVisitDate: {
      type: String,
      default: "",
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    consent: {
      type: Boolean,
      required: true,
      default: true,
    },
    source: {
      type: String,
      default: "quote-request-modal",
      trim: true,
    },
    emailStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      trim: true,
    },
    emailError: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export type ContactSubmissionDocument = InferSchemaType<
  typeof contactSubmissionSchema
>;

const ContactSubmission =
  (mongoose.models.ContactSubmission as Model<ContactSubmissionDocument>) ||
  mongoose.model<ContactSubmissionDocument>(
    "ContactSubmission",
    contactSubmissionSchema,
  );

export default ContactSubmission;
