import "server-only";
import type { ContentItem } from "../../lib/schemas/content";
import { hasHydratedContent } from "../../lib/utils/status";
import { AiTransportError, type AiRequest } from "../ai/client";
import { AiOutputError } from "../ai/validation";
import { generateContent } from "../ai/generators";
import type { GenerationContext, GeneratedContent } from "../ai/schemas";
import { ActionFailure } from "./service-error";

export async function generateItem(
  input: { itemId: string; regenerate: boolean; steer?: string },
  dependencies: {
    getItem: (id: string) => Promise<ContentItem | null>;
    context: (item: ContentItem, steer?: string) => Promise<GenerationContext>;
    generate: (
      request: AiRequest,
      signal?: AbortSignal,
    ) => Promise<{ content: string }>;
    save: (value: {
      item: ContentItem;
      content: GeneratedContent;
      prompt_version: string;
      regenerate: boolean;
    }) => Promise<ContentItem>;
    recordFailure: (item: ContentItem, message: string) => Promise<void>;
  },
  signal?: AbortSignal,
) {
  const item = await dependencies.getItem(input.itemId);
  if (!item)
    throw new ActionFailure("VALIDATION", "Content could not be found.");
  if (item.status === "posted")
    throw new ActionFailure(
      "VALIDATION",
      "Posted content cannot be generated.",
    );
  if (!input.regenerate && hasHydratedContent(item)) return item;
  let result: Awaited<ReturnType<typeof generateContent>>;
  try {
    result = await generateContent(
      await dependencies.context(item, input.steer),
      dependencies.generate,
      signal,
    );
  } catch (failure) {
    console.error("Item generation failed.");
    if (!(
      failure instanceof AiOutputError || failure instanceof AiTransportError
    ))
      throw failure;
    if (!input.regenerate && item.status === "idea")
      await dependencies.recordFailure(
        item,
        "Content generation did not complete.",
      );
    throw new ActionFailure(
      "GENERATION_FAILED",
      "Content generation did not complete.",
    );
  }
  // No content write occurs until every output/source rule has passed.
  return dependencies.save({ item, ...result, regenerate: input.regenerate });
}
