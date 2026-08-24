-- Add reconciled column to ledger tables for statement reconciliation tracking

ALTER TABLE public.petty_cash_ledger 
ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT false;

ALTER TABLE public.bank_ledger 
ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT false;

ALTER TABLE public.loan_ledger 
ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT false;
