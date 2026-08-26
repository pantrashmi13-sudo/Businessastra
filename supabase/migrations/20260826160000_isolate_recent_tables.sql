-- 1. Secure Consumptions Table
-- Add user_id column to public.consumptions
ALTER TABLE public.consumptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- Enable Row Level Security
ALTER TABLE public.consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumption_lines ENABLE ROW LEVEL SECURITY;

-- Drop old open policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.consumptions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.consumption_lines;

-- Create secure policies for consumptions
CREATE POLICY "user_consumptions_policy" ON public.consumptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_consumption_lines_policy" ON public.consumption_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.consumptions c
      WHERE c.id = consumption_lines.consumption_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consumptions c
      WHERE c.id = consumption_lines.consumption_id
      AND c.user_id = auth.uid()
    )
  );


-- 2. Secure Petty Cash, Bank Accounts, and Loans
-- These tables have company_id which links to public.companies (which is secured by user_id = auth.uid()).
-- Let's drop the old open policies.
DROP POLICY IF EXISTS "public all petty_cash_accounts" ON public.petty_cash_accounts;
DROP POLICY IF EXISTS "public all bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "public all loans" ON public.loans;
DROP POLICY IF EXISTS "public all petty_cash_ledger" ON public.petty_cash_ledger;
DROP POLICY IF EXISTS "public all bank_ledger" ON public.bank_ledger;
DROP POLICY IF EXISTS "public all loan_ledger" ON public.loan_ledger;

-- Create secure policies for Accounts
CREATE POLICY "user_petty_cash_accounts" ON public.petty_cash_accounts
  FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "user_bank_accounts" ON public.bank_accounts
  FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "user_loans" ON public.loans
  FOR ALL TO authenticated
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- Create secure policies for Ledgers (referencing isolated parent accounts)
CREATE POLICY "user_petty_cash_ledger" ON public.petty_cash_ledger
  FOR ALL TO authenticated
  USING (
    petty_cash_id IN (
      SELECT id FROM public.petty_cash_accounts
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    petty_cash_id IN (
      SELECT id FROM public.petty_cash_accounts
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "user_bank_ledger" ON public.bank_ledger
  FOR ALL TO authenticated
  USING (
    bank_account_id IN (
      SELECT id FROM public.bank_accounts
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    bank_account_id IN (
      SELECT id FROM public.bank_accounts
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "user_loan_ledger" ON public.loan_ledger
  FOR ALL TO authenticated
  USING (
    loan_id IN (
      SELECT id FROM public.loans
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    loan_id IN (
      SELECT id FROM public.loans
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );
