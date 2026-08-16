/**
 * Convert a number to Indian numbering words for sales invoice footers.
 * E.g., 1234567.89 → "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Eighty-Nine Paise Only"
 */

const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const tens = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o ? " " + ones[o] : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(ones[h] + " Hundred");
  if (r > 0) parts.push(twoDigits(r));
  return parts.join(" and ");
}

/**
 * Convert number to Indian words (supports up to 99,99,99,999.99)
 * Uses Indian numbering: ones, tens, hundreds, thousand, lakh, crore
 */
export function numberToWords(amount: number): string {
  if (amount === 0) return "Rupees Zero Only";

  const negative = amount < 0;
  const abs = Math.abs(amount);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  const parts: string[] = [];

  // Crore (1,00,00,000)
  const crore = Math.floor(intPart / 10000000);
  if (crore > 0) parts.push(threeDigits(crore) + " Crore");

  // Lakhs (1,00,000)
  const lakh = Math.floor((intPart % 10000000) / 100000);
  if (lakh > 0) parts.push(threeDigits(lakh) + " Lakh");

  // Thousands (1,000)
  const thousand = Math.floor((intPart % 100000) / 1000);
  if (thousand > 0) parts.push(threeDigits(thousand) + " Thousand");

  // Hundreds + remaining
  const remainder = intPart % 1000;
  if (remainder > 0) parts.push(threeDigits(remainder));

  const wordStr = parts.join(" ");
  const prefix = negative ? "Minus " : "";
  let result = `${prefix}Rupees ${wordStr}`;

  if (decPart > 0) {
    result += ` and ${twoDigits(decPart)} Paise`;
  }

  result += " Only";
  return result;
}
