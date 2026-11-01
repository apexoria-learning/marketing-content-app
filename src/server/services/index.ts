import "server-only";
import { changeContentStatus as persistStatus } from "../db/content";
import { getItem } from "../db/queries";
import { canChangeStatus, hasHydratedContent } from "../../lib/utils/status";
import { parseReadParams } from "../../lib/schemas/read-params";
import { getMonthItems } from "../db/queries";

export async function changeContentStatus(
  input: Parameters<typeof persistStatus>[0],
) {
  const item = await getItem(input.itemId);
  if (
    !item ||
    !canChangeStatus(item.status, input.status) ||
    (["ready", "skipped"].includes(input.status) && !hasHydratedContent(item))
  ) {
    throw Object.assign(new Error("Illegal content status transition."), {
      code: "23514",
    });
  }
  if (
    item.status === input.status &&
    !input.note?.trim() &&
    input.skipReason === undefined
  ) {
    const month = await getMonthItems(
      parseReadParams({ month: item.scheduled_date.slice(0, 7) }),
    );
    return {
      item: {
        id: item.id,
        scheduled_date: item.scheduled_date,
        status: item.status,
        posted_at: item.posted_at,
      },
      month_progress: {
        posted: month.filter((entry) => entry.status === "posted").length,
        planned: month.length,
      },
    };
  }
  // The RPC row lock and trigger remain authoritative if another writer races this check.
  return persistStatus(input);
}

export { appendActivityNote, updateBrandProfile } from "../db/content";
