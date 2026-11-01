import { TipCard } from "@/components/content/TipCard";
import type { Metadata } from "next";
import { ContentPreviewSchema } from "@/lib/schemas/content";
import { TodayDeck } from "@/features/content/TodayDeck";
import { parseReadParams } from "@/lib/schemas/read-params";
import { displayDate, shiftDate, todayInIst } from "@/lib/utils/dates";
import { getDailyTip, getMonthItems, getTodayItems } from "@/server/db/queries";
import { GenerationControl } from "@/features/content/GenerationControl";
import { env } from "@/server/config/env";

export const metadata: Metadata = { title: "Today" };

export default async function HomePage() {
  const today = todayInIst();
  const [items, tip, month] = await Promise.all([
    getTodayItems(today),
    getDailyTip(today),
    getMonthItems(parseReadParams({ month: today.slice(0, 7) })),
  ]);
  return (
    <>
      <TodayDeck
        items={items.map((item) => ContentPreviewSchema.parse(item))}
        progress={{
          posted: month.filter((item) => item.status === "posted").length,
          planned: month.length,
        }}
        dateLabel={displayDate(today, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        tomorrow={shiftDate(today, 1)}
        tip={
          <TipCard
            tip={tip}
            isFallback={Boolean(tip && tip.tip_date !== today)}
          />
        }
      />
      {!items.length ? (
        <GenerationControl
          enabled={env.AI_GENERATION_ENABLED === "true"}
          target={{ kind: "day", date: today }}
        />
      ) : null}
    </>
  );
}
