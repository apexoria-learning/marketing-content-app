import { Linter } from "eslint";
import { describe, expect, it } from "vitest";
import { apexoria } from "../../eslint-rules/index.mjs";

const linter = new Linter();

function lint(code, ruleId, options = []) {
  return linter.verify(code, [
    {
      plugins: { apexoria },
      rules: { [`apexoria/${ruleId}`]: ["error", ...options] },
    },
  ]);
}

describe("apexoria/no-raw-design-values", () => {
  const ruleId = "no-raw-design-values";

  it.each([
    ['const a = "bg-[#ff0000]";', "rawColour"],
    ['const a = "text-[#fff]";', "rawColour"],
    ['const a = "bg-[rgb(0,0,0)]";', "rawColour"],
    ['const a = "shadow-[0_0_0_rgba(0,0,0,0.5)]";', "rawColour"],
    ['const a = "p-[20px]";', "rawPixel"],
    ['const a = "min-h-[44px]";', "rawPixel"],
    ['const a = "w-[calc(100%-20px)]";', "rawPixel"],
    ["const a = `gap-[12px]`;", "rawPixel"],
  ])("rejects %s", (code, messageId) => {
    const messages = lint(code, ruleId);

    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe(messageId);
  });

  it.each([
    'const a = "bg-surface-1 text-secondary rounded-xl";',
    'const a = "px-page max-w-content";',
    'const a = "w-[calc(var(--spacing-page)*2)]";',
    'const a = "grid-cols-[1fr_auto]";',
    'const a = "/item/[id]";',
    'const a = "#0A0A0B";',
  ])("accepts %s", (code) => {
    expect(lint(code, ruleId)).toEqual([]);
  });

  it("reports every violation in a multi-class string", () => {
    const messages = lint('const a = "p-[20px] bg-[#fff]";', ruleId);

    expect(messages.map((message) => message.messageId)).toEqual([
      "rawPixel",
      "rawColour",
    ]);
  });
});

describe("apexoria/no-server-env-outside-server", () => {
  const ruleId = "no-server-env-outside-server";

  it.each([
    "const a = process.env.CRON_SECRET;",
    "const a = process.env.PORTKEY_API_KEY;",
    'const a = process.env["SUPABASE_SERVICE_ROLE_KEY"];',
  ])("rejects %s", (code) => {
    const messages = lint(code, ruleId);

    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe("serverEnv");
  });

  it("rejects dynamic access that cannot be verified as public", () => {
    const messages = lint("const a = process.env[name];", ruleId);

    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe("dynamicEnv");
  });

  it.each([
    "const a = process.env.NEXT_PUBLIC_SUPABASE_URL;",
    'const a = process.env["NEXT_PUBLIC_APP_URL"];',
    "const a = process.env.NODE_ENV;",
    "const a = other.env.CRON_SECRET;",
  ])("accepts %s", (code) => {
    expect(lint(code, ruleId)).toEqual([]);
  });

  it("honours a configured allowlist", () => {
    expect(
      lint("const a = process.env.CI;", ruleId, [{ allow: ["CI"] }]),
    ).toEqual([]);
    expect(
      lint("const a = process.env.NODE_ENV;", ruleId, [{ allow: ["CI"] }]),
    ).toHaveLength(1);
  });
});
