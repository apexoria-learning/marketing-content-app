const COUNT = new Intl.NumberFormat("en-IN");
const COMPACT = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCount(value: number): string {
  return COUNT.format(value);
}

/** Token totals grow large; compact form keeps summary tiles readable. */
export function formatTokens(value: number): string {
  return value < 10000 ? COUNT.format(value) : COMPACT.format(value);
}
