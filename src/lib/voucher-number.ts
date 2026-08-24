import { supabase } from "@/integrations/supabase/client";

/**
 * Generate the next voucher/document number based on financial year.
 *
 * Format: {PREFIX}-{FY_CODE}-{SEQ}
 *   FY_CODE = last 2 digits of start year + last 2 digits of end year
 *   e.g. BS 2081-2082 → "8182", AD 2025-2026 → "2526"
 *   SEQ = zero-padded 4-digit sequential number resetting each FY
 *
 * @param prefix  Document prefix: "SI", "DC", "RV", "PV"
 * @param table   Supabase table to query for last number
 * @param numberColumn  Column name storing the number (invoice_number / challan_number / voucher_number)
 * @param companyId  Active company ID
 */
export async function nextDocNumber(
  prefix: string,
  table: string,
  numberColumn: string,
  companyId: string,
): Promise<string> {
  // Fetch company FY settings
  const { data: company } = await supabase
    .from("companies" as any)
    .select("fy_start_year, fy_start_date, date_format")
    .eq("id", companyId)
    .single();

  const fyStartDate = (company as any)?.fy_start_date as string | null;
  const fyStartYear = (company as any)?.fy_start_year as number | null;
  const dateFormat = ((company as any)?.date_format as string) || "ad";

  // Determine FY code and start year
  let startYear: number;

  if (fyStartDate) {
    // Derive from stored fy_start_date (AD format YYYY-MM-DD)
    startYear = Number(fyStartDate.split("-")[0]);
  } else if (fyStartYear) {
    startYear = fyStartYear;
  } else {
    // Fallback: derive from current date
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (dateFormat === "bs") {
      const bsYear = currentYear + 56;
      startYear = currentMonth >= 4 ? bsYear : bsYear - 1;
    } else {
      startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    }
  }

  const endYear = startYear + 1;
  const fyCode = `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
  const seqPrefix = `${prefix}-${fyCode}-`;

  // Find the last number in this FY
  const { data } = await supabase
    .from(table as any)
    .select(numberColumn)
    .eq("company_id", companyId)
    .like(numberColumn, `${seqPrefix}%`)
    .order(numberColumn, { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (data && data.length > 0) {
    const row = data[0] as unknown as Record<string, unknown>;
    const lastNum = String(row[numberColumn] ?? "");
    const seqPart = lastNum.split("-").pop() ?? "";
    const parsed = parseInt(seqPart, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return `${seqPrefix}${String(nextSeq).padStart(4, "0")}`;
}
