import { z } from "zod";

const profileText = z.string().trim().min(1).max(2000);
const listEntry = z.string().trim().min(1).max(200);
const profileList = z.array(listEntry).max(40);

export const BrandProfileUpdateSchema = z
  .object({
    business_name: profileText.optional(),
    business_description: profileText.optional(),
    audience_description: profileText.optional(),
    courses: profileList.optional(),
    current_offers: z.string().trim().max(2000).nullable().optional(),
    tone_instagram: profileText.optional(),
    tone_linkedin: profileText.optional(),
    tone_whatsapp: profileText.optional(),
    do_list: profileList.optional(),
    dont_list: profileList.optional(),
    links: z.record(z.string().trim().min(1), z.url()).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export type BrandProfileUpdate = z.infer<typeof BrandProfileUpdateSchema>;
