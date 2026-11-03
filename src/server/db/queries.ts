import "server-only";
import { z } from "zod";
import {
  ActivitySchema,
  ContentItemSchema,
  DailyTipSchema,
  MonthSkeletonSchema,
  PillarSchema,
  type Activity,
} from "../../lib/schemas/content";
import {
  ArchiveCursorSchema,
  type ReadParams,
} from "../../lib/schemas/read-params";
import { monthBounds, shiftMonth, todayInIst } from "../../lib/utils/dates";
import { createUserDatabaseClient } from "./client";

const DISPLAY_NAME_BATCH = 200;

/**
 * Maps lower-cased emails to Google display names. Attribution is stored as
 * email; a name is presentation only, so an unavailable lookup (for example
 * before migration 0014 is applied) is logged and the UI shows the email.
 */
export async function getDisplayNames(
  emails: readonly (string | null)[],
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      emails
        .filter((email): email is string => Boolean(email))
        .map((email) => email.toLowerCase()),
    ),
  ];
  const names = new Map<string, string>();
  if (!unique.length) return names;
  try {
    const client = await createUserDatabaseClient();
    for (let start = 0; start < unique.length; start += DISPLAY_NAME_BATCH) {
      const { data, error } = await client.rpc("user_display_names", {
        p_emails: unique.slice(start, start + DISPLAY_NAME_BATCH),
      });
      if (error) throw error;
      for (const [email, name] of Object.entries(
        z.record(z.string(), z.string().min(1)).parse(data),
      ))
        names.set(email.toLowerCase(), name);
    }
  } catch (failure) {
    console.error("Display names unavailable; showing emails.", {
      code:
        typeof failure === "object" && failure !== null && "code" in failure
          ? String(failure.code)
          : undefined,
    });
  }
  return names;
}

function nameFor(names: Map<string, string>, email: string | null) {
  return email ? (names.get(email.toLowerCase()) ?? null) : null;
}

export async function withPosterNames<T extends { posted_by: string | null }>(
  items: T[],
): Promise<(T & { posted_by_name: string | null })[]> {
  const names = await getDisplayNames(items.map((item) => item.posted_by));
  return items.map((item) => ({
    ...item,
    posted_by_name: nameFor(names, item.posted_by),
  }));
}

export function decodeArchiveCursor(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    !/^[\w-]+$/.test(value)
  )
    return undefined;
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    const parsed = ArchiveCursorSchema.safeParse(decoded);
    return parsed.success ? parsed.data : undefined;
  } catch {
    // API.md §6.2 deliberately treats malformed cursors as page one.
    return undefined;
  }
}

export async function getTodayItems(date: string) {
  const client = await createUserDatabaseClient();
  const { data, error } = await client
    .from("content_items")
    .select("*")
    .eq("scheduled_date", date)
    .order("slot");
  if (error) throw error;
  return withPosterNames(z.array(ContentItemSchema).parse(data));
}

export async function getMonthItems(params: ReadParams) {
  const client = await createUserDatabaseClient();
  const { start, end } = monthBounds(params.month);
  let query = client
    .from("content_items")
    .select("*")
    .gte("scheduled_date", start)
    .lt("scheduled_date", end);
  if (params.platform) query = query.eq("platform", params.platform);
  if (params.pillar) query = query.eq("pillar", params.pillar);
  if (params.status) query = query.eq("status", params.status);
  const { data, error } = await query.order("scheduled_date").order("slot");
  if (error) throw error;
  return withPosterNames(z.array(ContentItemSchema).parse(data));
}

export async function getMonthPlan(month: string) {
  const client = await createUserDatabaseClient();
  const { data, error } = await client
    .from("content_plans")
    .select("*")
    .eq("plan_month", `${month}-01`)
    .maybeSingle();
  if (error) throw error;
  return data ? MonthSkeletonSchema.parse(data) : null;
}

export async function getCreateQueue(params: ReadParams) {
  const client = await createUserDatabaseClient();
  let query = client
    .from("content_items")
    .select("*")
    .in("status", ["idea", "ready"]);
  if (params.format) query = query.eq("format", params.format);
  if (params.platform) query = query.eq("platform", params.platform);
  const { data, error } = await query.order("scheduled_date").order("slot");
  if (error) throw error;
  return z.array(ContentItemSchema).parse(data);
}

export async function getItem(id: string) {
  const client = await createUserDatabaseClient();
  const { data, error } = await client
    .from("content_items")
    .select("*")
    .eq("id", z.uuid().parse(id))
    .maybeSingle();
  if (error) throw error;
  return data ? ContentItemSchema.parse(data) : null;
}

export async function getDailyTip(date: string) {
  const client = await createUserDatabaseClient();
  const { data, error } = await client
    .from("daily_tips")
    .select("*")
    .lte("tip_date", date)
    .order("tip_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? DailyTipSchema.parse(data) : null;
}

export async function getActivity(itemIds: string[]) {
  if (!itemIds.length) return [];
  const client = await createUserDatabaseClient();
  const activity: Activity[] = [];
  let cursor: Activity | undefined;
  while (true) {
    let query = client
      .from("activity_log")
      .select("*")
      .in("content_item_id", itemIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(500);
    if (cursor)
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      );
    const { data, error } = await query;
    if (error) throw error;
    const page = z.array(ActivitySchema).parse(data);
    activity.push(...page);
    if (page.length < 500) break;
    cursor = page.at(-1);
  }
  const names = await getDisplayNames(
    activity.map((event) => event.actor_email),
  );
  return activity.map((event) => ({
    ...event,
    actor_name: nameFor(names, event.actor_email),
  }));
}

export async function getArchive(
  params: ReadParams,
  rawCursor: unknown,
  platformKeys: readonly string[],
  pillarKeys: readonly string[],
) {
  const client = await createUserDatabaseClient();
  function filteredQuery(countOnly = false) {
    let query = client
      .from("content_items")
      .select("*", countOnly ? { count: "exact", head: true } : {})
      .eq("status", "posted");
    if (params.platform) query = query.eq("platform", params.platform);
    if (params.pillar) query = query.eq("pillar", params.pillar);
    if (params.format) query = query.eq("format", params.format);
    if (params.scope !== "all") {
      const month = shiftMonth(
        todayInIst().slice(0, 7),
        params.scope === "last_month" ? -1 : 0,
      );
      const { start, end } = monthBounds(month);
      query = query
        .gte("posted_at", `${start}T00:00:00+05:30`)
        .lt("posted_at", `${end}T00:00:00+05:30`);
    }
    return query;
  }
  async function count(query: ReturnType<typeof filteredQuery>) {
    const { count, error } = await query;
    if (error) throw error;
    return z.number().int().nonnegative().parse(count);
  }
  // Head-only counts avoid the PostgREST row cap as the archive grows.
  const [total, platforms, pillars] = await Promise.all([
    count(filteredQuery(true)),
    Promise.all(
      platformKeys.map(
        async (platform) =>
          [
            platform,
            await count(filteredQuery(true).eq("platform", platform)),
          ] as const,
      ),
    ),
    Promise.all(
      pillarKeys.map(
        async (pillar) =>
          [
            pillar,
            await count(filteredQuery(true).eq("pillar", pillar)),
          ] as const,
      ),
    ),
  ]);
  const summary = {
    total,
    platforms: Object.fromEntries(platforms),
    pillars: Object.fromEntries(pillars),
  };
  let query = filteredQuery();
  const cursor =
    params.scope === "all" ? decodeArchiveCursor(rawCursor) : undefined;
  if (cursor)
    query = query.or(
      `posted_at.lt.${cursor.posted_at},and(posted_at.eq.${cursor.posted_at},id.lt.${cursor.id})`,
    );
  query = query
    .order("posted_at", { ascending: false })
    .order("id", { ascending: false });
  if (params.scope === "all") query = query.limit(31);
  const { data, error } = await query;
  if (error) throw error;
  const parsed = z.array(ContentItemSchema).parse(data);
  const items = params.scope === "all" ? parsed.slice(0, 30) : parsed;
  const last = items.at(-1);
  return {
    items: await withPosterNames(items),
    summary,
    nextCursor:
      parsed.length > 30 && params.scope === "all" && last?.posted_at
        ? Buffer.from(
            JSON.stringify({ posted_at: last.posted_at, id: last.id }),
          ).toString("base64url")
        : undefined,
  };
}

export async function getHydrationQueue(limit = 10) {
  const client = await createUserDatabaseClient();
  const { data, error } = await client
    .from("content_items")
    .select("*")
    .eq("status", "idea")
    .order("scheduled_date")
    .order("slot")
    .limit(z.number().int().min(1).max(60).parse(limit));
  if (error) throw error;
  return z.array(ContentItemSchema).parse(data);
}

export async function getRecentPostedIdeas(date: string) {
  const client = await createUserDatabaseClient();
  const start = new Date(`${z.iso.date().parse(date)}T00:00:00+05:30`);
  start.setUTCDate(start.getUTCDate() - 60);
  const { data, error } = await client
    .from("content_items")
    .select("id,idea,pillar,posted_at")
    .eq("status", "posted")
    .gte("posted_at", start.toISOString())
    .order("posted_at", { ascending: false });
  if (error) throw error;
  return z
    .array(
      z.object({
        id: z.uuid(),
        idea: z.string(),
        pillar: PillarSchema,
        posted_at: z.iso.datetime({ offset: true }),
      }),
    )
    .parse(data);
}

export async function getRecentNews(limit = 20) {
  const client = await createUserDatabaseClient();
  const { data, error } = await client
    .from("news_items")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(z.number().int().min(1).max(100).parse(limit));
  if (error) throw error;
  return data;
}

export async function findNewsByHash(hash: string) {
  const client = await createUserDatabaseClient();
  const { data, error } = await client
    .from("news_items")
    .select("*")
    .eq(
      "url_hash",
      z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(hash),
    )
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRecentRuns() {
  const client = await createUserDatabaseClient();
  const { data, error } = await client
    .from("generation_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}
