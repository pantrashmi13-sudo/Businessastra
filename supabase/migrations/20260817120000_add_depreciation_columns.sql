-- Add depreciation tracking columns to fixed_assets
-- These columns enable running depreciation and tracking book value

ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS accumulated_depreciation NUMERIC(14,2) DEFAULT 0;

ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS book_value NUMERIC(14,2) DEFAULT 0;

ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS last_depreciation_date DATE;

-- Useful life and residual value for depreciation calculation
ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS useful_life INTEGER;

ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS residual_value NUMERIC(14,2) DEFAULT 0;

-- Depreciation rate (alternative to useful_life)
ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS depreciation_rate NUMERIC(5,2);

-- Opening balance fields for existing assets
ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS opening_qty INTEGER DEFAULT 0;

ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS opening_wdv NUMERIC(14,2) DEFAULT 0;

ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS is_opening BOOLEAN DEFAULT false;

-- Set initial book_value = purchase_cost + total_cost for existing assets
UPDATE public.fixed_assets 
SET book_value = COALESCE(purchase_cost, 0) + COALESCE(total_cost, 0)
WHERE book_value = 0 OR book_value IS NULL;
