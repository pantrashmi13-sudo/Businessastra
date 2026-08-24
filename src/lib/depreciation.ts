/**
 * Fixed Asset Depreciation Calculator
 * 
 * Supports:
 * - Straight Line Method: (Cost - Residual Value) / Useful Life OR Cost × Rate
 * - Declining Balance Method: Book Value × Rate OR Book Value / Remaining Life
 */

export interface AssetForDepreciation {
  id: string;
  asset_code: string;
  asset_name: string;
  category: string | null;
  purchase_cost: number;
  total_cost: number;
  purchase_date: string | null;
  depreciation_method: string | null;
  useful_life: number | null;
  depreciation_rate: number | null;
  residual_value: number;
  accumulated_depreciation: number;
  book_value: number;
  last_depreciation_date: string | null;
  status: string;
  is_opening: boolean;
  opening_wdv: number;
}

export interface DepreciationResult {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  landing_cost: number;
  previous_accumulated: number;
  period_depreciation: number;
  new_accumulated: number;
  new_book_value: number;
  method: string;
  useful_life: number | null;
  depreciation_rate: number | null;
  residual_value: number;
  from_date: string;
  to_date: string;
  months: number;
}

/**
 * Calculate months between two dates (fractional)
 */
function monthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();
  
  return years * 12 + months + (days / 30);
}

/**
 * Calculate depreciation for a single asset
 */
export function calculateDepreciation(
  asset: AssetForDepreciation,
  toDate: string = new Date().toISOString().slice(0, 10)
): DepreciationResult | null {
  // Skip disposed assets
  if (asset.status === "Disposed") return null;
  
  // Skip assets without depreciation method
  if (!asset.depreciation_method) return null;
  
  // Skip assets without useful life or depreciation rate
  const hasUsefulLife = asset.useful_life && asset.useful_life > 0;
  const hasRate = asset.depreciation_rate && asset.depreciation_rate > 0;
  if (!hasUsefulLife && !hasRate) return null;
  
  // Skip assets without purchase date (unless opening asset)
  if (!asset.purchase_date && !asset.is_opening) return null;
  
  const landingCost = Number(asset.purchase_cost || 0) + Number(asset.total_cost || 0);
  const residualValue = Number(asset.residual_value || 0);
  const usefulLife = asset.useful_life ? Number(asset.useful_life) : null;
  const rate = asset.depreciation_rate ? Number(asset.depreciation_rate) / 100 : null;
  const method = asset.depreciation_method;
  
  // Determine start date for depreciation calculation
  const fromDate = asset.last_depreciation_date || asset.purchase_date || toDate;
  
  // For opening assets, use opening_wdv as starting book value
  const startingBookValue = asset.is_opening && asset.opening_wdv > 0
    ? asset.opening_wdv
    : Number(asset.book_value || landingCost);
  
  // Don't calculate if already up to date
  if (fromDate >= toDate) return null;
  
  const months = monthsBetween(fromDate, toDate);
  let periodDepreciation = 0;
  
  if (method === "Straight Line") {
    if (hasRate) {
      // Rate-based: (Cost - Residual) × Rate × Months / 12
      const depreciableAmount = landingCost - residualValue;
      periodDepreciation = (depreciableAmount * (rate || 0) * months) / 12;
    } else if (usefulLife) {
      // Life-based: (Cost - Residual) / Useful Life × Months / 12
      const depreciableAmount = landingCost - residualValue;
      const annualDepreciation = depreciableAmount / usefulLife;
      periodDepreciation = (annualDepreciation * months) / 12;
    }
  } else if (method === "Declining Balance") {
    if (hasRate) {
      // Rate-based: Book Value × Rate × Months / 12
      periodDepreciation = (startingBookValue * (rate || 0) * months) / 12;
    } else if (usefulLife) {
      // Life-based: Book Value / Remaining Months × Months elapsed
      const totalMonthsLife = usefulLife * 12;
      const monthsElapsed = asset.purchase_date 
        ? monthsBetween(asset.purchase_date, toDate)
        : 0;
      const remainingMonths = Math.max(0, totalMonthsLife - monthsElapsed);
      
      if (remainingMonths <= 0) return null; // Asset fully depreciated
      periodDepreciation = (startingBookValue / remainingMonths) * months;
    }
  } else {
    return null;
  }
  
  // Don't depreciate below residual value
  const currentAccumulated = Number(asset.accumulated_depreciation || 0);
  const maxDepreciable = landingCost - residualValue - currentAccumulated;
  periodDepreciation = Math.min(periodDepreciation, maxDepreciable);
  
  // Don't process if depreciation is negligible
  if (periodDepreciation < 0.01) return null;
  
  const newAccumulated = currentAccumulated + periodDepreciation;
  const newBookValue = landingCost - newAccumulated;
  
  return {
    asset_id: asset.id,
    asset_code: asset.asset_code,
    asset_name: asset.asset_name,
    landing_cost: landingCost,
    previous_accumulated: currentAccumulated,
    period_depreciation: Math.round(periodDepreciation * 100) / 100,
    new_accumulated: Math.round(newAccumulated * 100) / 100,
    new_book_value: Math.round(newBookValue * 100) / 100,
    method,
    useful_life: usefulLife,
    depreciation_rate: rate ? Math.round(rate * 10000) / 100 : null,
    residual_value: residualValue,
    from_date: fromDate,
    to_date: toDate,
    months: Math.round(months * 10) / 10,
  };
}

/**
 * Calculate depreciation for multiple assets
 */
export function calculateBulkDepreciation(
  assets: AssetForDepreciation[],
  toDate: string = new Date().toISOString().slice(0, 10)
): DepreciationResult[] {
  const results: DepreciationResult[] = [];
  
  for (const asset of assets) {
    const result = calculateDepreciation(asset, toDate);
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}
