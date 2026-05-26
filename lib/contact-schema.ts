import { z } from "zod";

export const apartmentTypes = ["2 BHK", "3 BHK"] as const;
export const budgetRanges = [
  "Under 90L",
  "90L - 1.2Cr",
  "1.2Cr - 1.8Cr",
  "1.8Cr+",
] as const;
export const moveInOptions = [
  "Immediate",
  "Within 3 months",
  "Within 6 months",
  "Just exploring",
] as const;

const phonePattern = /^[+\d\s()\-]{10,18}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this within ${max} characters.`)
    .or(z.literal(""));

export const contactFieldSchemas = {
  fullName: z
    .string()
    .trim()
    .min(4, "Please enter your full name.")
    .max(80, "Name should be under 80 characters."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .email("Please enter a valid email address.")
    .max(120, "Email should be under 120 characters."),
  phone: z
    .string()
    .trim()
    .min(10, "Please enter your phone number.")
    .regex(phonePattern, "Please enter a valid phone number."),
  apartmentType: z.enum(apartmentTypes, {
    error: "Please select an apartment type.",
  }),
  budget: z.enum(budgetRanges, {
    error: "Please select a budget range.",
  }),
  moveInTimeline: z.enum(moveInOptions, {
    error: "Please select a move-in timeline.",
  }),
  siteVisitDate: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || datePattern.test(value),
      "Please choose a valid site visit date.",
    ),
  message: optionalTrimmedString(600),
  consent: z
    .boolean()
    .refine((value) => value, "Consent is required before submitting."),
} satisfies Record<string, z.ZodTypeAny>;

export const quoteRequestSchema = z.object(contactFieldSchemas);

export const contactPayloadSchema = quoteRequestSchema.extend({
  purchaseGoal: optionalTrimmedString(120).optional(),
  preferredContactTime: optionalTrimmedString(120).optional(),
});

export type QuoteRequestPayload = z.infer<typeof quoteRequestSchema>;
export type ContactPayload = z.infer<typeof contactPayloadSchema>;
