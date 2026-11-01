import { z } from "zod";
import { ReelBodySchema } from "@/lib/schemas/content";
import { CopyBlock } from "./CopyBlock";
export function ScriptList({ body }: { body: z.infer<typeof ReelBodySchema> }) {
  return (
    <section className="space-y-4">
      <CopyBlock
        label={`Script · ${body.duration_seconds} seconds`}
        text={`${body.scenes.map((scene) => `${scene.from}–${scene.to}\n${scene.action}\nOn screen: ${scene.on_screen_text}`).join("\n\n")}\n\nAudio: ${body.audio}`}
      />
      <ol className="divide-y divide-border">
        {body.scenes.map((scene) => (
          <li key={scene.from} className="space-y-2 py-4">
            <h3 className="font-mono text-body text-secondary">
              {scene.from}–{scene.to}
            </h3>
            <p className="whitespace-pre-wrap text-body text-primary">
              {scene.action}
            </p>
            <CopyBlock
              label={`On-screen text · ${scene.from}`}
              text={scene.on_screen_text}
            />
          </li>
        ))}
      </ol>
      <p className="text-body text-secondary">Audio: {body.audio}</p>
    </section>
  );
}
