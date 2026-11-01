import { z } from "zod";
import {
  FormatSchema,
  PillarSchema,
  PlatformSchema,
  StatusSchema,
} from "./content";
import { todayInIst } from "../utils/dates";

export const ReadParamsSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .refine(
      (value) =>
        Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 2100,
    )
    .catch(() => todayInIst().slice(0, 7)),
  platform: PlatformSchema.optional().catch(undefined),
  pillar: PillarSchema.optional().catch(undefined),
  format: FormatSchema.optional().catch(undefined),
  status: StatusSchema.optional().catch(undefined),
  scope: z.enum(["this_month", "last_month", "all"]).catch("this_month"),
});
export type ReadParams = z.infer<typeof ReadParamsSchema>;
export const ArchiveCursorSchema = z
  .object({
    posted_at: z.iso.datetime({ offset: true }),
    id: z.uuid(),
  })
  .strict();
export type ArchiveCursor = z.infer<typeof ArchiveCursorSchema>;

export function parseReadParams(value: unknown): ReadParams {
  return ReadParamsSchema.parse(value);
}
