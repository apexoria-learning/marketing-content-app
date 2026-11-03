import "server-only";
import type { AiRequest } from "../client";
import {
  buildContentPrompt,
  PROMPT_VERSION,
  versionedPrompt,
} from "../prompts";
import { GenerationContextSchema, type GenerationContext } from "../schemas";
import { AiOutputError, validateGeneratedContent } from "../validation";

export async function generateContent(
  input: GenerationContext,
  generate: (
    request: AiRequest,
    signal?: AbortSignal,
  ) => Promise<{ content: string }>,
  signal?: AbortSignal,
) {
  const context = GenerationContextSchema.parse(input);
  if (context.pillar_rules.requires_news && !context.news.length) {
    console.error("News generation refused without grounding.");
    throw new AiOutputError(["No news sources are available."]);
  }
  const prompt = buildContentPrompt(context);
  const repairedStages = new Set<AiOutputError["stage"]>();
  let request = prompt;
  while (true) {
    const response = await generate(request, signal);
    try {
      return {
        content: validateGeneratedContent(response.content, context),
        prompt_version: versionedPrompt(PROMPT_VERSION, context.instructions),
      };
    } catch (error) {
      if (!(error instanceof AiOutputError)) throw error;
      if (repairedStages.has(error.stage)) {
        console.error("Generated output failed its final validation.", {
          stage: error.stage,
        });
        throw error;
      }
      repairedStages.add(error.stage);
      console.warn("Generated output requires a repair.", {
        stage: error.stage,
        issues: error.issues,
      });
      request = {
        ...prompt,
        messages: [
          ...prompt.messages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: `Repair the JSON once for ${error.stage}. Fix these violations: ${JSON.stringify(error.issues)}`,
          },
        ],
      };
    }
  }
}
