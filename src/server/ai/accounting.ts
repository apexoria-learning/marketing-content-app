import "server-only";
import { z } from "zod";

const PricingSchema = z
  .object({
    input_usd_per_million: z.string().regex(/^\d{1,4}(\.\d{1,6})?$/),
    output_usd_per_million: z.string().regex(/^\d{1,4}(\.\d{1,6})?$/),
  })
  .strict();

export type TokenPricing = z.infer<typeof PricingSchema>;

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  input: TokenPricing,
) {
  const pricing = PricingSchema.parse(input);
  const tokens = z.number().int().nonnegative().max(2147483647);
  function micros(value: string) {
    const [whole, fraction = ""] = value.split(".");
    return (
      BigInt(whole ?? "0") * BigInt(1000000) + BigInt(fraction.padEnd(6, "0"))
    );
  }
  const numerator =
    BigInt(tokens.parse(inputTokens)) * micros(pricing.input_usd_per_million) +
    BigInt(tokens.parse(outputTokens)) * micros(pricing.output_usd_per_million);
  const rounded = (numerator + BigInt(500000)) / BigInt(1000000);
  if (rounded > BigInt(9999999999))
    throw new Error("Generation cost exceeds storage limits.");
  return `${rounded / BigInt(1000000)}.${(rounded % BigInt(1000000)).toString().padStart(6, "0")}`;
}
