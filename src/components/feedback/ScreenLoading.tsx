import { PageHeader } from "../shell/PageHeader";
import { Skeleton } from "../ui/Skeleton";

export function ScreenLoading({
  surface,
}: {
  surface:
    "Today" | "Calendar" | "Create" | "Content details" | "Archive" | "Admin";
}) {
  return (
    <>
      <PageHeader
        title={surface}
        back={surface === "Content details" || surface === "Admin"}
        actions={
          surface === "Today" ? (
            <Skeleton className="size-14 rounded-pill" />
          ) : undefined
        }
      />
      <p role="status" className="sr-only">
        Loading {surface.toLowerCase()}
      </p>
      <div data-screen-loading className="mt-8 space-y-6">
        {surface === "Today" ? (
          <>
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </>
        ) : null}
        {surface === "Calendar" ? (
          <>
            <Skeleton className="h-11 rounded-md" />
            <div className="calendar-grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }, (_, index) => (
                <Skeleton key={index} className="min-h-16 rounded-sm" />
              ))}
            </div>
            <div className="calendar-agenda space-y-3">
              {Array.from({ length: 7 }, (_, index) => (
                <Skeleton key={index} className="h-13 rounded-md" />
              ))}
            </div>
          </>
        ) : null}
        {surface === "Create"
          ? ["Carousels", "Reels", "Posts", "Stories", "Memes", "Polls"].map(
              (group) => (
                <section key={group}>
                  <h2 className="mb-3 text-eyebrow text-secondary">{group}</h2>
                  <div className="space-y-3">
                    {[1, 2, 3].map((row) => (
                      <Skeleton key={row} className="h-16 rounded-md" />
                    ))}
                  </div>
                </section>
              ),
            )
          : null}
        {surface === "Content details"
          ? [
              "Caption",
              "Body",
              "Hashtags",
              "Call to action",
              "Design brief",
            ].map((label) => (
              <section key={label}>
                <h2 className="mb-3 text-eyebrow text-secondary">{label}</h2>
                <Skeleton className="h-32 rounded-md" />
              </section>
            ))
          : null}
        {surface === "Archive" ? (
          <>
            <Skeleton className="h-16 rounded-md" />
            {[1, 2, 3, 4, 5].map((row) => (
              <Skeleton key={row} className="h-32 rounded-lg" />
            ))}
          </>
        ) : null}
        {surface === "Admin" ? (
          <>
            <Skeleton className="h-11 rounded-pill" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((tile) => (
                <Skeleton key={tile} className="h-20 rounded-lg" />
              ))}
            </div>
            {[1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-16 rounded-md" />
            ))}
          </>
        ) : null}
      </div>
    </>
  );
}
