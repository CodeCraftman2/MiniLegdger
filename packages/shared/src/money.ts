// Money is always an integer number of paise. Only format to rupees for display.

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Parses user input like "1,250.50" into paise. Returns null if it isn't a valid amount. */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,₹\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/**
 * Indian digit grouping (₹1,23,456). Hand-rolled instead of Intl.NumberFormat('en-IN')
 * so the output is identical on Node and on Hermes/Android.
 */
export function formatRupees(paise: number, opts: { alwaysShowPaise?: boolean } = {}): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const body = groupIndian(String(whole));
  const fracStr = frac === 0 && !opts.alwaysShowPaise ? "" : `.${String(frac).padStart(2, "0")}`;
  return `${negative ? "-" : ""}₹${body}${fracStr}`;
}
