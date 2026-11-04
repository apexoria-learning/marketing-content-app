"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../../lib/schemas/action-result";
import {
  AddNoteInputSchema,
  MarkPostedInputSchema,
  SkipItemInputSchema,
  type AddNoteInput,
  type MarkPostedInput,
  type SkipItemInput,
} from "../../lib/schemas/actions";
import { runAuthorizedAction } from "./run-action";
import {
  HydrateItemInputSchema,
  RegenerateItemInputSchema,
  PlanMonthInputSchema,
  GenerateForDayInputSchema,
  type HydrateItemInput,
  type RegenerateItemInput,
  type PlanMonthInput,
  type GenerateForDayInput,
} from "../../lib/schemas/planning";
import {
  generateContentItem,
  generateDay,
  getHydrationAllowance,
} from "../services/content-generation";
import {
  generateMonth,
  getMonthPlanAllowance,
} from "../services/month-generation";
import { consumeGenerationBudget } from "../security";
import { appendActivityNote, changeContentStatus } from "../services";

function revalidateContentPaths(itemId: string): void {
  for (const path of [
    "/",
    "/calendar",
    "/create",
    "/archive",
    `/item/${itemId}`,
  ]) {
    revalidatePath(path);
  }
}

export async function markPosted(input: MarkPostedInput): Promise<
  ActionResult<{
    posted_at: string | null;
    month_progress: { posted: number; planned: number };
  }>
> {
  return runAuthorizedAction(
    input,
    MarkPostedInputSchema,
    async (value) => {
      const item = await changeContentStatus({
        itemId: value.item_id,
        status: value.posted ? "posted" : "ready",
        note: value.note,
      });

      return {
        posted_at: item.item.posted_at,
        month_progress: item.month_progress,
      };
    },
    (value) => revalidateContentPaths(value.item_id),
  );
}

export async function skipItem(
  input: SkipItemInput,
): Promise<ActionResult<{ status: "ready" | "skipped" }>> {
  return runAuthorizedAction(
    input,
    SkipItemInputSchema,
    async (value) => {
      await changeContentStatus({
        itemId: value.item_id,
        status: value.skipped ? "skipped" : "ready",
        skipReason: value.reason,
      });
      return {
        status: value.skipped ? ("skipped" as const) : ("ready" as const),
      };
    },
    (value) => revalidateContentPaths(value.item_id),
  );
}

export async function addNote(
  input: AddNoteInput,
): Promise<ActionResult<{ ok: true }>> {
  return runAuthorizedAction(
    input,
    AddNoteInputSchema,
    async (value, email) => {
      await appendActivityNote({
        itemId: value.item_id,
        actorEmail: email,
        note: value.note,
      });
      return { ok: true as const };
    },
    (value) => revalidateContentPaths(value.item_id),
  );
}

export async function hydrateItem(input: HydrateItemInput) {
  return runAuthorizedAction(
    input,
    HydrateItemInputSchema,
    (value) => generateContentItem(value.item_id, false),
    (value) => revalidateContentPaths(value.item_id),
    (email, value) => getHydrationAllowance(value.item_id, email),
  );
}

export async function regenerateItem(input: RegenerateItemInput) {
  return runAuthorizedAction(
    input,
    RegenerateItemInputSchema,
    (value) => generateContentItem(value.item_id, true, value.steer),
    (value) => revalidateContentPaths(value.item_id),
    (email) => consumeGenerationBudget(email),
  );
}

export async function planMonth(input: PlanMonthInput) {
  return runAuthorizedAction(
    input,
    PlanMonthInputSchema,
    (value) => generateMonth(value.month),
    () => {
      revalidatePath("/calendar");
      revalidatePath("/create");
      revalidatePath("/");
    },
    (email, value) => getMonthPlanAllowance(value.month, email),
  );
}

export async function generateForDay(input: GenerateForDayInput) {
  return runAuthorizedAction(
    input,
    GenerateForDayInputSchema,
    (value) => generateDay(value.date, value.count),
    () => {
      revalidatePath("/calendar");
      revalidatePath("/create");
      revalidatePath("/");
    },
    (email) => consumeGenerationBudget(email),
  );
}
