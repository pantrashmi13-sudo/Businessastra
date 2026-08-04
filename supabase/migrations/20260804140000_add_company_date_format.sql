-- Add date_format column to companies table
-- 'ad' = Gregorian (2024-01-15), 'bs' = Bikram Sambat/Nepali (2080-10-01)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'ad' CHECK (date_format IN ('ad', 'bs'));
