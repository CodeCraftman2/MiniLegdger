// UPI payment links (the NPCI "upi://pay" deep link). Money moves directly from the friend's UPI app
// to the lender's UPI ID; MiniLedger never touches it, so the app can't see whether it was paid.

const UPI_ID_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

export const isValidUpiId = (value: string) => UPI_ID_RE.test(value.trim());

/** Integer paise to a "123.45" string without going through floating point. */
const paiseToDecimal = (paise: number) =>
  `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;

export type UpiRequest = {
  upiId: string;
  /** Name shown to the payer in their UPI app. */
  payeeName: string;
  amountPaise: number;
  /** Shown as the payment note; trimmed to 50 characters. */
  note?: string;
};

export function buildUpiUri({ upiId, payeeName, amountPaise, note }: UpiRequest): string {
  const params: [string, string][] = [
    ["pa", upiId.trim()],
    ["pn", payeeName.trim() || "Payee"],
    ["am", paiseToDecimal(amountPaise)],
    ["cu", "INR"],
  ];
  if (note?.trim()) params.push(["tn", note.trim().slice(0, 50)]);
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
