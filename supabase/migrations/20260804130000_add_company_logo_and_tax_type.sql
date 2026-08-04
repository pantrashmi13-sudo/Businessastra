-- Add logo column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add tax_type column to track if company uses VAT or PAN
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'vat' CHECK (tax_type IN ('vat', 'pan'));
