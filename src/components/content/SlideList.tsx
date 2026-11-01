import { z } from "zod";
import { CarouselBodySchema } from "@/lib/schemas/content";
import { CopyBlock } from "./CopyBlock";
export function SlideList({
  body,
}: {
  body: z.infer<typeof CarouselBodySchema>;
}) {
  return (
    <section className="space-y-4">
      <CopyBlock
        label="All slides"
        text={body.slides
          .map(
            (slide) =>
              `${slide.index}. ${slide.headline}\n${slide.body}${slide.visual_note ? `\nVisual: ${slide.visual_note}` : ""}`,
          )
          .join("\n\n")}
      />
      <ol className="divide-y divide-border">
        {body.slides.map((slide) => (
          <li key={slide.index} className="py-4">
            <h3 className="text-h3 font-semibold text-primary">
              <span className="mr-2 inline-flex size-7 items-center justify-center rounded-sm bg-surface-2 font-mono">
                {slide.index}
              </span>
              {slide.headline}
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-body text-primary">
              {slide.body}
            </p>
            {slide.visual_note ? (
              <p className="mt-2 text-caption text-secondary">
                Visual: {slide.visual_note}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
