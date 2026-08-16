-- Add sales_ledger, purchase_ledger, tds_applicable, tds_rate to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sales_ledger TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS purchase_ledger TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS tds_applicable BOOLEAN DEFAULT false;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5,2) DEFAULT 0;
