/**
 * AD (Gregorian) ↔ BS (Bikram Sambat / Nepali) date conversion utility.
 *
 * The BS calendar has varying month lengths per year. This module uses a
 * lookup table covering BS years 2000–2090 (approx. AD 1943–2034).
 *
 * Storage format in DB: always YYYY-MM-DD in AD.
 * Display format: depends on company.date_format ('ad' or 'bs').
 */

// ── BS month lengths for each BS year (from 2000) ──────────────────
// Each entry: [totalDaysInYear, ...monthLengths (12 months)]
const BS_DATA: Record<number, [number, ...number[]]> = {
  2000: [365, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2001: [365, 30, 31, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2002: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2003: [365, 31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2004: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2005: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2006: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2007: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2008: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2009: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2010: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 29, 31],
  2011: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2012: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2013: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2014: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 29, 31],
  2015: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2016: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2017: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2018: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2019: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2020: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2021: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2022: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2023: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2024: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2025: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2026: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2027: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2028: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2029: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2030: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2031: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2032: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2033: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2034: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2035: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2036: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2037: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2038: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2039: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2040: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2041: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2042: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2043: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2044: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2045: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2046: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2047: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2048: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2049: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2050: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2051: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2052: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2053: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2054: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2055: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2056: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2057: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2058: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2059: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2060: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2061: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2062: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2063: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2064: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2065: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2066: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2067: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2068: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2069: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2070: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2071: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2072: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2073: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2074: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2075: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2076: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2077: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2079: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2080: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2081: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2083: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2084: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2085: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2086: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
  2087: [365, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2088: [366, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2089: [365, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2090: [365, 31, 31, 32, 31, 32, 30, 30, 30, 29, 30, 30, 31],
};

const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

const BS_MONTHS_NP = [
  "बैशाख", "जेठ", "असार", "श्रावण", "भाद्र", "आश्विन",
  "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुन", "चैत्र",
];

const AD_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ── Reference date: BS 2080-01-01 = AD 2023-04-14 ──────────────────
const BS_EPOCH_BS = { year: 2080, month: 1, day: 1 };
const BS_EPOCH_AD = new Date(2023, 3, 14); // April 14, 2023

function daysInBsYear(year: number): number {
  const data = BS_DATA[year];
  return data ? data[0] : 365;
}

function daysInBsMonth(year: number, month: number): number {
  const data = BS_DATA[year];
  if (!data) return 30;
  return data[month] || 30;
}

function totalDaysFromBsStart(year: number, month: number, day: number): number {
  let total = 0;
  for (let y = 2000; y < year; y++) {
    total += daysInBsYear(y);
  }
  for (let m = 1; m < month; m++) {
    total += daysInBsMonth(year, m);
  }
  total += day - 1;
  return total;
}

function bsFromTotalDays(totalDays: number): { year: number; month: number; day: number } {
  let remaining = totalDays;
  let year = 2000;

  while (year <= 2090) {
    const yearDays = daysInBsYear(year);
    if (remaining < yearDays) break;
    remaining -= yearDays;
    year++;
  }

  let month = 1;
  while (month <= 12) {
    const monthDays = daysInBsMonth(year, month);
    if (remaining < monthDays) break;
    remaining -= monthDays;
    month++;
  }

  return { year, month, day: remaining + 1 };
}

// ── Public API ──────────────────────────────────────────────────────

export type DateFormat = "ad" | "bs";

export interface BSDate {
  year: number;
  month: number;
  day: number;
}

export interface ADDate {
  year: number;
  month: number;
  day: number;
}

/** Convert AD date (YYYY-MM-DD) to BS date */
export function adToBs(adDateStr: string): BSDate | null {
  if (!adDateStr) return null;
  const parts = adDateStr.split("-");
  if (parts.length !== 3) return null;

  const adDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const diffTime = adDate.getTime() - BS_EPOCH_AD.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const bsTotal = totalDaysFromBsStart(BS_EPOCH_BS.year, BS_EPOCH_BS.month, BS_EPOCH_BS.day) + diffDays;
  return bsFromTotalDays(bsTotal);
}

/** Convert BS date (YYYY-MM-DD) to AD date */
export function bsToAd(bsYear: number, bsMonth: number, bsDay: number): ADDate | null {
  if (bsYear < 2000 || bsYear > 2090) return null;

  const bsTotal = totalDaysFromBsStart(bsYear, bsMonth, bsDay);
  const epochTotal = totalDaysFromBsStart(BS_EPOCH_BS.year, BS_EPOCH_BS.month, BS_EPOCH_BS.day);
  const diffDays = bsTotal - epochTotal;

  const adDate = new Date(BS_EPOCH_AD.getTime() + diffDays * 24 * 60 * 60 * 1000);
  return {
    year: adDate.getFullYear(),
    month: adDate.getMonth() + 1,
    day: adDate.getDate(),
  };
}

/** Format date string based on company format */
export function formatDate(dateStr: string | null, format: DateFormat): string {
  if (!dateStr) return "—";

  if (format === "bs") {
    const bs = adToBs(dateStr);
    if (!bs) return dateStr;
    return `${bs.year}-${String(bs.month).padStart(2, "0")}-${String(bs.day).padStart(2, "0")}`;
  }

  // AD format - just return as-is
  return dateStr;
}

/** Format date for display (e.g., "15 Jan 2024" or "1 Baisakh 2081") */
export function formatDateLong(dateStr: string | null, format: DateFormat): string {
  if (!dateStr) return "—";

  if (format === "bs") {
    const bs = adToBs(dateStr);
    if (!bs) return dateStr;
    const monthName = BS_MONTHS[bs.month - 1] || "";
    return `${bs.day} ${monthName} ${bs.year}`;
  }

  // AD format
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const monthName = AD_MONTHS[parseInt(parts[1]) - 1] || "";
  return `${parseInt(parts[2])} ${monthName} ${parts[0]}`;
}

/** Get BS month name */
export function getBsMonthName(month: number): string {
  return BS_MONTHS[month - 1] || "";
}

/** Get BS month name in Nepali */
export function getBsMonthNameNp(month: number): string {
  return BS_MONTHS_NP[month - 1] || "";
}

/** Convert BS date string (YYYY-MM-DD) input to AD for storage */
export function bsInputToAd(bsDateStr: string): string | null {
  if (!bsDateStr) return null;
  const parts = bsDateStr.split("-");
  if (parts.length !== 3) return null;

  const ad = bsToAd(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
  if (!ad) return null;
  return `${ad.year}-${String(ad.month).padStart(2, "0")}-${String(ad.day).padStart(2, "0")}`;
}

/** Convert AD date to BS string for display input */
export function adToBsInput(adDateStr: string): string {
  if (!adDateStr) return "";
  const bs = adToBs(adDateStr);
  if (!bs) return adDateStr;
  return `${bs.year}-${String(bs.month).padStart(2, "0")}-${String(bs.day).padStart(2, "0")}`;
}

/** Get days in a BS month */
export { daysInBsMonth };

/** BS month names */
export { BS_MONTHS };
