-- Add financial year columns to companies table
-- fy_start_year stores the starting year (e.g. 2081 for BS, 2025 for AD)
-- fy_start_date stores the actual start date (01-04 of the year)
-- fy_end_date stores the actual end date (31-03 of next year)

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS fy_start_year INTEGER;

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS fy_start_date DATE;

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS fy_end_date DATE;
