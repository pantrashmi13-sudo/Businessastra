-- Create enum types for cash and bank
DO $$ BEGIN
  CREATE TYPE public.loan_type AS ENUM ('personal', 'business', 'home', 'vehicle', 'education', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create petty_cash_accounts table
CREATE TABLE IF NOT EXISTS public.petty_cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder_name TEXT,
  branch TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create loans table
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  loan_type public.loan_type NOT NULL DEFAULT 'personal',
  loan_name TEXT NOT NULL,
  principal_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  loan_opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  loan_outstanding NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  lender_name TEXT,
  emi_amount NUMERIC(14,2),
  tenure_months INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create petty_cash_ledger table
CREATE TABLE IF NOT EXISTS public.petty_cash_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  petty_cash_id UUID NOT NULL REFERENCES public.petty_cash_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bank_ledger table
CREATE TABLE IF NOT EXISTS public.bank_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create loan_ledger table
CREATE TABLE IF NOT EXISTS public.loan_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  interest_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  principal_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_petty_cash_accounts_company ON public.petty_cash_accounts (company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON public.bank_accounts (company_id);
CREATE INDEX IF NOT EXISTS idx_loans_company ON public.loans (company_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_ledger_petty_cash ON public.petty_cash_ledger (petty_cash_id);
CREATE INDEX IF NOT EXISTS idx_bank_ledger_bank_account ON public.bank_ledger (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_loan_ledger_loan ON public.loan_ledger (loan_id);

-- Create unique indexes for names per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_petty_cash_accounts_name_uidx ON public.petty_cash_accounts (company_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_number_uidx ON public.bank_accounts (company_id, account_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_name_uidx ON public.loans (company_id, loan_name);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_accounts TO anon, authenticated;
GRANT ALL ON public.petty_cash_accounts TO service_role;
ALTER TABLE public.petty_cash_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO anon, authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO anon, authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_ledger TO anon, authenticated;
GRANT ALL ON public.petty_cash_ledger TO service_role;
ALTER TABLE public.petty_cash_ledger ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_ledger TO anon, authenticated;
GRANT ALL ON public.bank_ledger TO service_role;
ALTER TABLE public.bank_ledger ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_ledger TO anon, authenticated;
GRANT ALL ON public.loan_ledger TO service_role;
ALTER TABLE public.loan_ledger ENABLE ROW LEVEL SECURITY;

-- Create policies for full public access (matching other tables)
CREATE POLICY "public all petty_cash_accounts" ON public.petty_cash_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all bank_accounts" ON public.bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all petty_cash_ledger" ON public.petty_cash_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all bank_ledger" ON public.bank_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all loan_ledger" ON public.loan_ledger FOR ALL USING (true) WITH CHECK (true);

-- Create triggers for setting updated_at
CREATE TRIGGER trg_petty_cash_accounts_updated
  BEFORE UPDATE ON public.petty_cash_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bank_accounts_updated
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_loans_updated
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_petty_cash_ledger_updated
  BEFORE UPDATE ON public.petty_cash_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bank_ledger_updated
  BEFORE UPDATE ON public.bank_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_loan_ledger_updated
  BEFORE UPDATE ON public.loan_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
