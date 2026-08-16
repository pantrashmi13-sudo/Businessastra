import { round2 } from "./format";

export interface BillTotalsInput {
  lines: Array<{ quantity: number; per_unit: number; vat_rate: number }>;
  exempted_amount?: number;
  discount?: number;
  transportation?: number;
  other_charges?: number;
  transportation_vat_rate?: number;
  other_charges_vat_rate?: number;
}

export interface BillTotals {
  taxable_amount: number;
  vat_amount: number;
  final_amount: number;
}

export const computeLineAmount = (qty: number, per: number) =>
  round2((Number(qty) || 0) * (Number(per) || 0));

export const computeBillTotals = (input: BillTotalsInput): BillTotals => {
  let subtotal = 0;
  const lineAmounts = input.lines.map((l) => computeLineAmount(l.quantity, l.per_unit));
  subtotal = round2(lineAmounts.reduce((acc, a) => acc + a, 0));

  const discount = Number(input.discount) || 0;
  const transportation = Number(input.transportation) || 0;
  const other = Number(input.other_charges) || 0;
  const transRate = Number(input.transportation_vat_rate) || 0;
  const otherRate = Number(input.other_charges_vat_rate) || 0;

  // Distribute discount proportionally across lines for VAT calculation
  let vat_amount = 0;
  input.lines.forEach((l, i) => {
    const line_amount = lineAmounts[i];
    const proportion = subtotal > 0 ? line_amount / subtotal : 0;
    const line_discount = round2(proportion * discount);
    const discounted_amount = Math.max(0, round2(line_amount - line_discount));
    const rate = Number(l.vat_rate) || 0;
    if (rate > 0) {
      vat_amount += round2(discounted_amount * rate / 100);
    }
  });

  const transVat = round2(transportation * transRate / 100);
  const otherVat = round2(other * otherRate / 100);

  vat_amount = round2(vat_amount + transVat + otherVat);

  const taxable_amount = round2(subtotal - discount);
  const final_amount = round2(
    taxable_amount + vat_amount + transportation + other
  );

  return {
    taxable_amount,
    vat_amount: round2(vat_amount),
    final_amount,
  };
};

// ── Sales Invoice Totals (VAT-exclusive calculation) ────────────────
// Items are exclusive of VAT. Discount is applied to subtotal, then VAT is levied.

export interface SalesInvoiceLineInput {
  quantity: number;
  per_unit: number;
  vat_rate: number;
}

export interface SalesInvoiceTotalsInput {
  lines: Array<SalesInvoiceLineInput>;
  discount?: number;
}

export interface SalesInvoiceLineOutput {
  line_amount: number;
  discounted_amount: number;
  vat_amount: number;
}

export interface SalesInvoiceTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  vat_amount: number;
  total_amount: number;
  line_outputs: SalesInvoiceLineOutput[];
}

export const computeSalesInvoiceTotals = (input: SalesInvoiceTotalsInput): SalesInvoiceTotals => {
  // 1. Compute each line amount (exclusive of VAT)
  const lineAmounts = input.lines.map((l) => computeLineAmount(l.quantity, l.per_unit));
  const subtotal = round2(lineAmounts.reduce((acc, a) => acc + a, 0));

  const discount = Number(input.discount) || 0;

  // 2. Distribute discount proportionally across lines
  const line_outputs: SalesInvoiceLineOutput[] = input.lines.map((l, i) => {
    const line_amount = lineAmounts[i];
    const proportion = subtotal > 0 ? line_amount / subtotal : 0;
    const line_discount = round2(proportion * discount);
    const discounted_amount = round2(line_amount - line_discount);
    const vat_rate = Number(l.vat_rate) || 0;
    const vat_amount = round2(discounted_amount * vat_rate / 100);
    return { line_amount, discounted_amount, vat_amount };
  });

  const taxable = round2(subtotal - discount);
  const vat_amount = round2(line_outputs.reduce((acc, lo) => acc + lo.vat_amount, 0));
  const total_amount = round2(taxable + vat_amount);

  return { subtotal, discount, taxable, vat_amount, total_amount, line_outputs };
};