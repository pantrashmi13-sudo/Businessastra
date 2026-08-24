-- Add direct_account_id columns to receipts and payments
ALTER TABLE public.receipt_vouchers ADD COLUMN IF NOT EXISTS direct_account_id UUID;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS direct_account_id UUID;

-- Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  coa_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_coa_name UNIQUE (company_id, coa_id, name)
);

-- Grant permissions for accounts
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO anon, authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy for accounts
CREATE POLICY "Tenant isolation for accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Create trigger for setting updated_at on accounts table
CREATE OR REPLACE TRIGGER trg_accounts_updated
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Create journal_entries table
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  voucher_number TEXT NOT NULL,
  narration TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('sales_invoice', 'bill', 'receipt_voucher', 'payment_voucher', 'manual')),
  source_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_voucher_number UNIQUE (company_id, voucher_number)
);

-- Grant permissions for journal_entries
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO anon, authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy for journal_entries
CREATE POLICY "Tenant isolation for journal_entries" ON public.journal_entries
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Create trigger for setting updated_at on journal_entries table
CREATE OR REPLACE TRIGGER trg_journal_entries_updated
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Create journal_lines table
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
  credit NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
  narration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_debit_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

-- Grant permissions for journal_lines
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO anon, authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy for journal_lines (via join to journal_entries)
CREATE POLICY "Tenant isolation for journal_lines" ON public.journal_lines
  FOR ALL TO authenticated
  USING (
    journal_entry_id IN (
      SELECT id FROM public.journal_entries WHERE company_id IN (
        SELECT id FROM public.companies WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    journal_entry_id IN (
      SELECT id FROM public.journal_entries WHERE company_id IN (
        SELECT id FROM public.companies WHERE user_id = auth.uid()
      )
    )
  );

-- Create trigger for setting updated_at on journal_lines table
CREATE OR REPLACE TRIGGER trg_journal_lines_updated
  BEFORE UPDATE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Trigger function to prevent delete of account/customer/vendor if journaled
CREATE OR REPLACE FUNCTION public.prevent_delete_if_journaled()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'accounts' THEN
    IF EXISTS (SELECT 1 FROM public.journal_lines WHERE account_id = old.id) THEN
      RAISE EXCEPTION 'Cannot delete account % because it has journal transactions.', old.name;
    END IF;
  ELSIF TG_TABLE_NAME = 'customers' THEN
    IF EXISTS (
      SELECT 1 FROM public.journal_lines jl
      JOIN public.accounts a ON jl.account_id = a.id
      WHERE a.name = old.name AND a.company_id IN (
        SELECT id FROM public.companies WHERE user_id = old.user_id
      ) AND a.coa_id IN (
        SELECT id FROM public.chart_of_accounts WHERE name = 'Trade Receivables'
      )
    ) THEN
      RAISE EXCEPTION 'Cannot delete customer % because they have journal postings.', old.name;
    END IF;
  ELSIF TG_TABLE_NAME = 'vendors' THEN
    IF EXISTS (
      SELECT 1 FROM public.journal_lines jl
      JOIN public.accounts a ON jl.account_id = a.id
      WHERE a.name = old.name AND a.company_id IN (
        SELECT id FROM public.companies WHERE user_id = old.user_id
      ) AND a.coa_id IN (
        SELECT id FROM public.chart_of_accounts WHERE name IN ('Trade payables', 'Other Creditors')
      )
    ) THEN
      RAISE EXCEPTION 'Cannot delete vendor % because they have journal postings.', old.name;
    END IF;
  END IF;
  RETURN old;
END;
$$ LANGUAGE plpgsql;

-- Apply delete prevention triggers
DROP TRIGGER IF EXISTS trg_prevent_delete_account ON public.accounts;
CREATE TRIGGER trg_prevent_delete_account
  BEFORE DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_if_journaled();

DROP TRIGGER IF EXISTS trg_prevent_delete_customer ON public.customers;
CREATE TRIGGER trg_prevent_delete_customer
  BEFORE DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_if_journaled();

DROP TRIGGER IF EXISTS trg_prevent_delete_vendor ON public.vendors;
CREATE TRIGGER trg_prevent_delete_vendor
  BEFORE DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_if_journaled();


-- Sync trigger function for Customer/Vendor/Bank/Cash/Loans to Accounts
CREATE OR REPLACE FUNCTION public.sync_entity_to_account()
RETURNS trigger AS $$
DECLARE
  comp_rec RECORD;
  coa_id UUID;
  constructed_name TEXT;
BEGIN
  -- Handle delete
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'customers' THEN
      FOR comp_rec IN SELECT id FROM public.companies WHERE user_id = old.user_id LOOP
        SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_rec.id AND name = 'Trade Receivables' LIMIT 1;
        IF coa_id IS NOT NULL THEN
          DELETE FROM public.accounts WHERE company_id = comp_rec.id AND coa_id = coa_id AND name = old.name;
        END IF;
      END LOOP;
    ELSIF TG_TABLE_NAME = 'vendors' THEN
      FOR comp_rec IN SELECT id FROM public.companies WHERE user_id = old.user_id LOOP
        SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_rec.id AND name = 'Trade payables' LIMIT 1;
        IF coa_id IS NOT NULL THEN
          DELETE FROM public.accounts WHERE company_id = comp_rec.id AND coa_id = coa_id AND name = old.name;
        END IF;
      END LOOP;
    ELSIF TG_TABLE_NAME = 'bank_accounts' THEN
      constructed_name := old.bank_name || ' ' || COALESCE(old.branch, '') || ' (' || old.account_number || ')';
      DELETE FROM public.accounts WHERE company_id = old.company_id AND name = constructed_name;
    ELSIF TG_TABLE_NAME = 'petty_cash_accounts' THEN
      DELETE FROM public.accounts WHERE company_id = old.company_id AND name = old.name;
    ELSIF TG_TABLE_NAME = 'loans' THEN
      DELETE FROM public.accounts WHERE company_id = old.company_id AND name = old.loan_name;
    END IF;
    RETURN old;
  END IF;

  -- Handle insert/update
  IF TG_TABLE_NAME = 'customers' THEN
    FOR comp_rec IN SELECT id FROM public.companies WHERE user_id = new.user_id LOOP
      SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_rec.id AND name = 'Trade Receivables' LIMIT 1;
      IF coa_id IS NOT NULL THEN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO public.accounts (company_id, coa_id, name)
          VALUES (comp_rec.id, coa_id, new.name) ON CONFLICT (company_id, coa_id, name) DO NOTHING;
        ELSIF TG_OP = 'UPDATE' AND old.name <> new.name THEN
          UPDATE public.accounts SET name = new.name WHERE company_id = comp_rec.id AND coa_id = coa_id AND name = old.name;
        END IF;
      END IF;
    END LOOP;

  ELSIF TG_TABLE_NAME = 'vendors' THEN
    FOR comp_rec IN SELECT id FROM public.companies WHERE user_id = new.user_id LOOP
      SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_rec.id AND name = 'Trade payables' LIMIT 1;
      IF coa_id IS NOT NULL THEN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO public.accounts (company_id, coa_id, name)
          VALUES (comp_rec.id, coa_id, new.name) ON CONFLICT (company_id, coa_id, name) DO NOTHING;
        ELSIF TG_OP = 'UPDATE' AND old.name <> new.name THEN
          UPDATE public.accounts SET name = new.name WHERE company_id = comp_rec.id AND coa_id = coa_id AND name = old.name;
        END IF;
      END IF;
    END LOOP;

  ELSIF TG_TABLE_NAME = 'bank_accounts' THEN
    constructed_name := new.bank_name || ' ' || COALESCE(new.branch, '') || ' (' || new.account_number || ')';
    SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = new.company_id AND name = 'Cash & Cash Equivalents' LIMIT 1;
    IF coa_id IS NOT NULL THEN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO public.accounts (company_id, coa_id, name)
        VALUES (new.company_id, coa_id, constructed_name) ON CONFLICT (company_id, coa_id, name) DO NOTHING;
      ELSIF TG_OP = 'UPDATE' AND (old.bank_name <> new.bank_name OR old.account_number <> new.account_number OR COALESCE(old.branch, '') <> COALESCE(new.branch, '')) THEN
        UPDATE public.accounts SET name = constructed_name WHERE company_id = new.company_id AND coa_id = coa_id AND name = (old.bank_name || ' ' || COALESCE(old.branch, '') || ' (' || old.account_number || ')');
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'petty_cash_accounts' THEN
    SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = new.company_id AND name = 'Cash & Cash Equivalents' LIMIT 1;
    IF coa_id IS NOT NULL THEN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO public.accounts (company_id, coa_id, name)
        VALUES (new.company_id, coa_id, new.name) ON CONFLICT (company_id, coa_id, name) DO NOTHING;
      ELSIF TG_OP = 'UPDATE' AND old.name <> new.name THEN
        UPDATE public.accounts SET name = new.name WHERE company_id = new.company_id AND coa_id = coa_id AND name = old.name;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'loans' THEN
    -- Determine correct loan coa node
    SELECT id INTO coa_id FROM public.chart_of_accounts 
    WHERE company_id = new.company_id AND name = 
      CASE 
        WHEN new.loan_name ILIKE '%Working Capital%' THEN 'Working Capital Loan'
        WHEN new.loan_name ILIKE '%Fixed Term%' THEN 'Fixed Term Loan'
        WHEN new.loan_name ILIKE '%Overdraft%' THEN 'Overdraft'
        WHEN new.loan_name ILIKE '%Force%' THEN 'Force Loan'
        WHEN new.loan_name ILIKE '%Trust%Receipt%' THEN 'Trust-Receipt Loan'
        WHEN new.loan_name ILIKE '%Adhoc%' THEN 'Adhoc Loan'
        ELSE 'Short-Term Loan'
      END
    LIMIT 1;

    IF coa_id IS NULL THEN
      SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = new.company_id AND name = 'Short-Term Loan' LIMIT 1;
    END IF;

    IF coa_id IS NOT NULL THEN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO public.accounts (company_id, coa_id, name)
        VALUES (new.company_id, coa_id, new.loan_name) ON CONFLICT (company_id, coa_id, name) DO NOTHING;
      ELSIF TG_OP = 'UPDATE' AND old.loan_name <> new.loan_name THEN
        UPDATE public.accounts SET name = new.loan_name WHERE company_id = new.company_id AND coa_id = coa_id AND name = old.loan_name;
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Set up sync triggers
DROP TRIGGER IF EXISTS trg_sync_customers ON public.customers;
CREATE TRIGGER trg_sync_customers
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.sync_entity_to_account();

DROP TRIGGER IF EXISTS trg_sync_vendors ON public.vendors;
CREATE TRIGGER trg_sync_vendors
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.sync_entity_to_account();

DROP TRIGGER IF EXISTS trg_sync_bank_accounts ON public.bank_accounts;
CREATE TRIGGER trg_sync_bank_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_entity_to_account();

DROP TRIGGER IF EXISTS trg_sync_petty_cash_accounts ON public.petty_cash_accounts;
CREATE TRIGGER trg_sync_petty_cash_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.petty_cash_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_entity_to_account();

DROP TRIGGER IF EXISTS trg_sync_loans ON public.loans;
CREATE TRIGGER trg_sync_loans
  AFTER INSERT OR UPDATE OR DELETE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.sync_entity_to_account();


-- Function to seed standard accounts from organization CSV
CREATE OR REPLACE FUNCTION public.seed_company_accounts(comp_id UUID)
RETURNS void AS $$
DECLARE
  coa_id UUID;
BEGIN
  -- Code 1200: Other Assets
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1200' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Accre 8 CLIA 1'),
      (comp_id, coa_id, 'Accre 8 CLIA 2'),
      (comp_id, coa_id, 'Accumulated Depreciation'),
      (comp_id, coa_id, 'Accumulated Depreciation- Other Assets'),
      (comp_id, coa_id, 'M000204 Electrolyte Analyzer')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1130: Software
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1130' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Intangible Assets-Accum Amortization'),
      (comp_id, coa_id, 'Busy Software')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1160: Computer & Peripherals
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1160' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Accumulated Depreciation- Computers'),
      (comp_id, coa_id, 'Brother 2540 Printer'),
      (comp_id, coa_id, 'Computer Desktop'),
      (comp_id, coa_id, 'Laptop'),
      (comp_id, coa_id, 'Network System'),
      (comp_id, coa_id, 'HP & Lenovo Laptop'),
      (comp_id, coa_id, 'H.P Envy 14 Core  5'),
      (comp_id, coa_id, 'Dell I5 Laptop'),
      (comp_id, coa_id, 'Dell I7 Laptop'),
      (comp_id, coa_id, 'Asus Vivobook I5 13th Gen (Laptop)'),
      (comp_id, coa_id, 'Dell 3520 Laptop'),
      (comp_id, coa_id, 'Dell Monitor 27Inc'),
      (comp_id, coa_id, 'Dell Wireless Keyboard'),
      (comp_id, coa_id, 'Frontech Mouse'),
      (comp_id, coa_id, 'Havit Keyboard'),
      (comp_id, coa_id, 'Monitor Dell 24 inch'),
      (comp_id, coa_id, 'Printer Brother 2540'),
      (comp_id, coa_id, 'Printers'),
      (comp_id, coa_id, 'Speaker 15 Inch'),
      (comp_id, coa_id, 'Thermal Transfer Printer')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1170: Furniture & Fixtures
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1170' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Furniture & Fixture-Accum Depn'),
      (comp_id, coa_id, 'Furniture & Fixture'),
      (comp_id, coa_id, 'Furniture _ Rack'),
      (comp_id, coa_id, 'Sofa Set'),
      (comp_id, coa_id, 'Steel Storage Rack')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1210: Vehicles
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1210' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Vehicle-Accum Depn'),
      (comp_id, coa_id, 'Shine 125 DLX BS6'),
      (comp_id, coa_id, 'Honda Shine SP125 DLX'),
      (comp_id, coa_id, 'Isuzu Pikup'),
      (comp_id, coa_id, 'Komaki EV Scooter'),
      (comp_id, coa_id, 'Saluto Bike'),
      (comp_id, coa_id, 'Vehicle (BA028 CHA 1962 NEXON)'),
      (comp_id, coa_id, 'Vehicle (Outlander)'),
      (comp_id, coa_id, 'Vehicle- Accum Depn'),
      (comp_id, coa_id, 'Yamaha Soluto'),
      (comp_id, coa_id, 'Kia Car'),
      (comp_id, coa_id, 'TATA TIAGO EV'),
      (comp_id, coa_id, 'Vehicle ( Komaki Scooter)'),
      (comp_id, coa_id, 'Xtreme 125 RCBS Hero')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1010: Advance Income tax
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1010' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Advance Income Tax')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1000: ATR
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1000' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'ATR (IRD)'),
      (comp_id, coa_id, 'ATR Receivable'),
      (comp_id, coa_id, 'Unidentified Party(ATR)')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1020: ETDS
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1020' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'ETDS (IRD )'),
      (comp_id, coa_id, 'TDS Receivable'),
      (comp_id, coa_id, 'Previous Year TDS Receivable')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1040: Bank Margins
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1040' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Bank Guarantee Margin'),
      (comp_id, coa_id, 'Bank Margin- LC Margin'),
      (comp_id, coa_id, 'Bank Margin - NRB'),
      (comp_id, coa_id, 'Bank Margin (NIMB_LC)'),
      (comp_id, coa_id, 'Bank Margin (NIMB_TT)')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1050: Loans & Advances
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1050' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Ganesh Pandey'),
      (comp_id, coa_id, 'Arjun Sapkota'),
      (comp_id, coa_id, 'NIRDOSH KHANAL'),
      (comp_id, coa_id, 'Padam  Sir'),
      (comp_id, coa_id, 'Prashansa Shrestha'),
      (comp_id, coa_id, 'Manoj Kumar Sah'),
      (comp_id, coa_id, 'Travelling Advance ( Customer)'),
      (comp_id, coa_id, 'Sobit Parasai'),
      (comp_id, coa_id, 'Saurav Baduwal'),
      (comp_id, coa_id, 'Sudip shivakoti')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1060: Securities & Deposits (Asset)
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1060' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'VAT Refund A/c'),
      (comp_id, coa_id, 'Security Deposit (Dharauti 5%)'),
      (comp_id, coa_id, 'Security Deposit ( Dharuti 5%)'),
      (comp_id, coa_id, 'Dharuti At DRI')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1090: Prepaid Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1090' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Prepaid Insurance'),
      (comp_id, coa_id, 'Prepaid Insurance (Import)')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1110: Suspense
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1110' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Suspense Account')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1120: Deferred Tax Assets
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1120' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Deffered Tax')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1140: Website
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1140' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Website Development')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1150: Building
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1150' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Sankhamual Building'),
      (comp_id, coa_id, 'Building-Accum Depn')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1180: Land
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1180' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Attariya Land Kitta No XX'),
      (comp_id, coa_id, 'Imadol Land Kitta No 561'),
      (comp_id, coa_id, 'Harisiddi land _ k.1399_ S. 0-7-3-0'),
      (comp_id, coa_id, 'Sanagaun Land Kitta No 1064,1069,1078,17'),
      (comp_id, coa_id, 'Shankhamul Land Kitta No 857'),
      (comp_id, coa_id, 'RAJ KUMAR SYANTANG ( Imadol Land )')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 1190: Office Equipments
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '1190' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'ABC 2KG Fire Extinguisher'),
      (comp_id, coa_id, 'ABC 4KG Fire Extinguisher'),
      (comp_id, coa_id, 'CCTV'),
      (comp_id, coa_id, 'Light Board'),
      (comp_id, coa_id, 'Mobile'),
      (comp_id, coa_id, 'Office Equipments'),
      (comp_id, coa_id, 'Office Equipments-Accum Depn'),
      (comp_id, coa_id, 'Projecter'),
      (comp_id, coa_id, 'Water Pump motor'),
      (comp_id, coa_id, 'Xiaomi Pad 6 6/128'),
      (comp_id, coa_id, 'Mi Redmi Note 14g 8/256'),
      (comp_id, coa_id, 'Tools Equipment')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2060: CIT Payable
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2060' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'CIT Payable')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2070: Rent Payable
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2070' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Rent payable')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2080: Salary Payable
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2080' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Salary & Bonus Payable'),
      (comp_id, coa_id, 'Salary Payable'),
      (comp_id, coa_id, 'Leave Encashment Payable'),
      (comp_id, coa_id, 'Staff Salary Payable')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2090: TDS Payable
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2090' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'SST on Salary'),
      (comp_id, coa_id, 'TDS on Accounting Exp'),
      (comp_id, coa_id, 'TDS On Audit Fees'),
      (comp_id, coa_id, 'Tds on Expo Expenses'),
      (comp_id, coa_id, 'TDS on Legal Expenses'),
      (comp_id, coa_id, 'TDs on NFRS Fees'),
      (comp_id, coa_id, 'TDS on Rent'),
      (comp_id, coa_id, 'TDS On Service Charge'),
      (comp_id, coa_id, 'SST Payable'),
      (comp_id, coa_id, 'TDS on Advertisement'),
      (comp_id, coa_id, 'TDS on AMC Charge'),
      (comp_id, coa_id, 'TDS on BLS Charge'),
      (comp_id, coa_id, 'TDS on Business Promotion'),
      (comp_id, coa_id, 'TDS on Cargo & Couriers'),
      (comp_id, coa_id, 'TDS on Consultancy Fees'),
      (comp_id, coa_id, 'TDS On Dividend'),
      (comp_id, coa_id, 'Tds On Freight'),
      (comp_id, coa_id, 'TDS on Internet'),
      (comp_id, coa_id, 'TDS on NTA Certificate Fees'),
      (comp_id, coa_id, 'TDS on Salary'),
      (comp_id, coa_id, 'Tds on Software Expenses'),
      (comp_id, coa_id, 'TDS on Sponsorship'),
      (comp_id, coa_id, 'TDS on Training Fees'),
      (comp_id, coa_id, 'TDS On Transportaion'),
      (comp_id, coa_id, 'Tds on Wages'),
      (comp_id, coa_id, 'TDS on Website Development'),
      (comp_id, coa_id, 'TDS Payable'),
      (comp_id, coa_id, 'TDS on Loading Unloading')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2100: VAT Payable
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2100' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'VAT'),
      (comp_id, coa_id, 'VAT PAYABLE')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2130: Audit Fee Payable
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2130' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Audit Fee Payable')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2140: Bonus Payable
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2140' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Bonus Payable')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2170: Other Payables
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2170' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Expenses Payable'),
      (comp_id, coa_id, 'NEA Bill Payable'),
      (comp_id, coa_id, 'Provision for Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2180: Provision for Income Tax
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2180' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Provision for Income Tax')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2190: Staff Payables
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2190' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Incentive Payable to Staff'),
      (comp_id, coa_id, 'Insurance Claim Payable to Staff')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2200: Deferred tax liabilities
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2200' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Deferred tax liabilities')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2250: Dividend
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2250' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Dividend')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2260: Other Equity
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2260' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Profit & Loss')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 2270: Share Capital
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '2270' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Share Capital')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4000: Sales
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4000' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Rate Difference'),
      (comp_id, coa_id, 'Sales')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4010: Other Income
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4010' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Other Income')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4020: Rent Income
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4020' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Rent Income')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4030: Service Income
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4030' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Service Charges Receipts')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4040: Audit Fees
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4040' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Audit Fee')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4050: Bank Charges
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4050' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Bank Charges')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4060: Bank Commission
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4060' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Bank Commission')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4070: Consulantancy Fee
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4070' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'NFRS Implementation Fees'),
      (comp_id, coa_id, 'Consultancy Fee'),
      (comp_id, coa_id, 'NTA Certification Fees')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4080: Electricity Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4080' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Electricity Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4090: Employee Cost
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4090' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Dashain Allowance'),
      (comp_id, coa_id, 'Incentive & Bonus to Staff Expesnes'),
      (comp_id, coa_id, 'Leave Encashments'),
      (comp_id, coa_id, 'Salary & Allowance Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4100: Health and Amenities
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4100' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Health And Ammonites')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4110: IT & Communication
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4110' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Internet And Software Expenses'),
      (comp_id, coa_id, 'Telephone Recharge Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4120: Insurance
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4120' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Insurance'),
      (comp_id, coa_id, 'Insurance - Local Transport'),
      (comp_id, coa_id, 'Insurance - Property'),
      (comp_id, coa_id, 'Insurance - Staff'),
      (comp_id, coa_id, 'Insurance - Stock'),
      (comp_id, coa_id, 'Insurance - Vehicles')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4130: Legal Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4130' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Legal Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4140: Local Tax, Renewal & Registration
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4140' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Land Rokka Expenses'),
      (comp_id, coa_id, 'Local Tax, Renewal & Registration'),
      (comp_id, coa_id, 'Valuation Report Charge Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4150: Mess Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4150' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Food & Snacks - BOD Meeting'),
      (comp_id, coa_id, 'Food & Snacks - Other'),
      (comp_id, coa_id, 'Food & Snacks - Staff Claim on OT work'),
      (comp_id, coa_id, 'Food Expenses -M.B'),
      (comp_id, coa_id, 'Kitchen Expenses - Staff Khaja Claim'),
      (comp_id, coa_id, 'Kitchen Expenses - Staff Khaja Purchase')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4160: Misc.Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4160' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Interest on TDS'),
      (comp_id, coa_id, 'Service Charges Paid'),
      (comp_id, coa_id, 'Other Expenses -M.B'),
      (comp_id, coa_id, 'Miscellaneous Expenses'),
      (comp_id, coa_id, 'Rate Diffrents/ Good Return')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4170: Office Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4170' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Office Expenses'),
      (comp_id, coa_id, 'Computer Accessories'),
      (comp_id, coa_id, 'Festival Expenses'),
      (comp_id, coa_id, 'Uniform Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4180: Parking Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4180' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Parking Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4190: Printing & Stationery
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4190' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Printing & Stationery')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4200: Renewal & Registration Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4200' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Renewal & Registration Fee'),
      (comp_id, coa_id, 'Entrance Fee')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4210: Rent Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4210' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Godown Rent'),
      (comp_id, coa_id, 'Office Rent')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4220: Repair & Maintenance
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4220' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Repair & Maintanance - Vehicle'),
      (comp_id, coa_id, 'Repair & Maintenance'),
      (comp_id, coa_id, 'Repair & Maintenance - Office'),
      (comp_id, coa_id, 'Repair & Maintenance- Computers'),
      (comp_id, coa_id, 'Electricity Installation Expenses'),
      (comp_id, coa_id, 'Repair & Maintenance - Building'),
      (comp_id, coa_id, 'Repair & Maintenance - Equipments & Furniture'),
      (comp_id, coa_id, 'Repair & Maintenance - Office Vehicle'),
      (comp_id, coa_id, 'Repair & Maintenance - Personal Vehicle'),
      (comp_id, coa_id, 'Repair & Maintenance- Internet'),
      (comp_id, coa_id, 'Repair & Maintenance- Printer'),
      (comp_id, coa_id, 'Mobile Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4230: Round Off
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4230' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Rounded Off'),
      (comp_id, coa_id, 'Short & Excess')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4240: Staff Welfare
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4240' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Staff Welfare Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4250: Subscriptions
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4250' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Busy Online Service'),
      (comp_id, coa_id, 'Busy Service AMC'),
      (comp_id, coa_id, 'Busy BLS Service')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4260: Tax Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4260' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Income Tax Expenses'),
      (comp_id, coa_id, 'Vat Expense'),
      (comp_id, coa_id, 'Full Audit Tax'),
      (comp_id, coa_id, 'Previous Year Tax'),
      (comp_id, coa_id, 'Tax Paid'),
      (comp_id, coa_id, 'TDS Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4270: Tour and Travelling
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4270' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Dubai Expenses'),
      (comp_id, coa_id, 'Foreign Tour Expenses'),
      (comp_id, coa_id, 'Thailand Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4280: Training Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4280' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Training Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4290: Travelling Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4290' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Travelling Expenses'),
      (comp_id, coa_id, 'Local Travel & Conveyance'),
      (comp_id, coa_id, 'Travelling Expenses - M.B.')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4300: Direct Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4300' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Bank Charges -Imports'),
      (comp_id, coa_id, 'Clearing Charges'),
      (comp_id, coa_id, 'Custom Duty'),
      (comp_id, coa_id, 'Customs Service'),
      (comp_id, coa_id, 'Do Charges'),
      (comp_id, coa_id, 'Excise Duty'),
      (comp_id, coa_id, 'Freight & Forwarding Charges Taxable'),
      (comp_id, coa_id, 'Freight & Forwarding Charges Exempted'),
      (comp_id, coa_id, 'Insurance (Imports)'),
      (comp_id, coa_id, 'Other Charges(Imports)'),
      (comp_id, coa_id, 'Consumable Items'),
      (comp_id, coa_id, 'Loading Unloading Import'),
      (comp_id, coa_id, 'Warehouse Charges'),
      (comp_id, coa_id, 'Weight Charges')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4310: Purchase of Goods
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4310' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Purchase')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4320: Advertisement & Publicity
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4320' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Advertisement & Publicity')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4330: Business Promotion Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4330' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Business Promotion'),
      (comp_id, coa_id, 'Events Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4340: Cargo & Couriers Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4340' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Cargo & Couriers expenses'),
      (comp_id, coa_id, 'Transport Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4350: Discount Allowed
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4350' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Discount')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4360: Exhibition Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4360' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Expo Expenses ( Exhibition )')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4370: Fuel Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4370' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Fuel Expenses (N)'),
      (comp_id, coa_id, 'Fuel Expenses_Office Vehicle'),
      (comp_id, coa_id, 'Fuel Expenses_Personal Vehicle'),
      (comp_id, coa_id, 'Fuel Expenses-BOD')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4380: Installation Charge
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4380' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Installation Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4390: Loading Unloading
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4390' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Labour Charge'),
      (comp_id, coa_id, 'Loading Unloading')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4400: Marketing Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4400' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Marketing Expenses'),
      (comp_id, coa_id, 'BOD Marketing Expenses (M.B)')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4410: Sponsorship  Fee
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4410' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Sponsorship  Fee')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4420: Tender Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4420' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Tender Expenses')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4430: Depreciation and Amortization Expense
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4430' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Depreciation & Amortization A/c')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4440: Bank Interest
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4440' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Bank Interest - CCRLV'),
      (comp_id, coa_id, 'Bank Interest- Force Loan'),
      (comp_id, coa_id, 'Bank Interest - TR'),
      (comp_id, coa_id, 'Bank Interest - WCL'),
      (comp_id, coa_id, 'Bank Interest - CCNRLV'),
      (comp_id, coa_id, 'Bank Interest - HPL'),
      (comp_id, coa_id, 'Bank Interest- Adhoc Loan'),
      (comp_id, coa_id, 'Bank Interest- Fixed Term Loan'),
      (comp_id, coa_id, 'Bank Interest- STL'),
      (comp_id, coa_id, 'Bank Interest- Overdue Period')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4450: Interest on Unsecured Loans
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4450' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Interest On Unsecured Loans')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4460: Loan Processing & Renewal Expenses
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4460' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Loan Processing & Renewal Fee')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4470: Fine and Penalty
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4470' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Fines and Penalties')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4480: Forex (Gain)/Loss
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4480' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Exchange Gain & Loss')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;

  -- Code 4490: Gift And Donation
  SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND account_code = '4490' LIMIT 1;
  IF coa_id IS NOT NULL THEN
    INSERT INTO public.accounts (company_id, coa_id, name) VALUES
      (comp_id, coa_id, 'Gift And Donation')
    ON CONFLICT (company_id, coa_id, name) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- Seeding existing entities to accounts table
CREATE OR REPLACE FUNCTION public.seed_existing_entities_to_accounts()
RETURNS void AS $$
DECLARE
  r RECORD;
  coa_id UUID;
  comp_id UUID;
BEGIN
  -- 1. Sync existing customers
  FOR r IN SELECT id, name, user_id FROM public.customers LOOP
    SELECT id INTO comp_id FROM public.companies WHERE user_id = r.user_id LIMIT 1;
    IF comp_id IS NOT NULL THEN
      SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND name = 'Trade Receivables' LIMIT 1;
      IF coa_id IS NOT NULL THEN
        INSERT INTO public.accounts (company_id, coa_id, name)
        VALUES (comp_id, coa_id, r.name)
        ON CONFLICT (company_id, coa_id, name) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  -- 2. Sync existing vendors
  FOR r IN SELECT id, name, user_id FROM public.vendors LOOP
    SELECT id INTO comp_id FROM public.companies WHERE user_id = r.user_id LIMIT 1;
    IF comp_id IS NOT NULL THEN
      SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = comp_id AND name = 'Trade payables' LIMIT 1;
      IF coa_id IS NOT NULL THEN
        INSERT INTO public.accounts (company_id, coa_id, name)
        VALUES (comp_id, coa_id, r.name)
        ON CONFLICT (comp_id, coa_id, name) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  -- 3. Sync existing bank accounts
  FOR r IN SELECT id, bank_name, account_number, branch, company_id FROM public.bank_accounts LOOP
    IF r.company_id IS NOT NULL THEN
      SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = r.company_id AND name = 'Cash & Cash Equivalents' LIMIT 1;
      IF coa_id IS NOT NULL THEN
        INSERT INTO public.accounts (company_id, coa_id, name)
        VALUES (r.company_id, coa_id, r.bank_name || ' ' || COALESCE(r.branch, '') || ' (' || r.account_number || ')')
        ON CONFLICT (company_id, coa_id, name) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  -- 4. Sync existing petty cash accounts
  FOR r IN SELECT id, name, company_id FROM public.petty_cash_accounts LOOP
    IF r.company_id IS NOT NULL THEN
      SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = r.company_id AND name = 'Cash & Cash Equivalents' LIMIT 1;
      IF coa_id IS NOT NULL THEN
        INSERT INTO public.accounts (company_id, coa_id, name)
        VALUES (r.company_id, coa_id, r.name)
        ON CONFLICT (company_id, coa_id, name) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  -- 5. Sync existing loans
  FOR r IN SELECT id, loan_name, loan_type, company_id FROM public.loans LOOP
    IF r.company_id IS NOT NULL THEN
      SELECT id INTO coa_id FROM public.chart_of_accounts 
      WHERE company_id = r.company_id AND name = 
        CASE 
          WHEN r.loan_name ILIKE '%Working Capital%' THEN 'Working Capital Loan'
          WHEN r.loan_name ILIKE '%Fixed Term%' THEN 'Fixed Term Loan'
          WHEN r.loan_name ILIKE '%Overdraft%' THEN 'Overdraft'
          WHEN r.loan_name ILIKE '%Force%' THEN 'Force Loan'
          WHEN r.loan_name ILIKE '%Trust%Receipt%' THEN 'Trust-Receipt Loan'
          WHEN r.loan_name ILIKE '%Adhoc%' THEN 'Adhoc Loan'
          ELSE 'Short-Term Loan'
        END
      LIMIT 1;

      IF coa_id IS NULL THEN
        SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = r.company_id AND name = 'Short-Term Loan' LIMIT 1;
      END IF;

      IF coa_id IS NOT NULL THEN
        INSERT INTO public.accounts (company_id, coa_id, name)
        VALUES (r.company_id, coa_id, r.loan_name)
        ON CONFLICT (company_id, coa_id, name) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- Seeding standard accounts and existing entities for all current companies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_company_accounts(r.id);
  END LOOP;
  PERFORM public.seed_existing_entities_to_accounts();
END $$;


-- Trigger to auto-seed accounts on new company insertion
CREATE OR REPLACE FUNCTION public.trg_seed_new_company_accounts()
RETURNS trigger AS $$
BEGIN
  PERFORM public.seed_company_accounts(new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_companies_seed_accounts ON public.companies;
CREATE TRIGGER trg_companies_seed_accounts
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_new_company_accounts();


-- Transaction Journal Auto-posting Logic

-- 1. Bills (Purchase Invoices)
CREATE OR REPLACE FUNCTION public.post_bill_journal_entry(b_id UUID)
RETURNS void AS $$
DECLARE
  bill_rec RECORD;
  vendor_name TEXT;
  vendor_acc_id UUID;
  purchase_acc_id UUID;
  vat_acc_id UUID;
  tds_acc_id UUID;
  je_id UUID;
  line_desc TEXT;
BEGIN
  SELECT b.*, v.name as vendor_name 
  INTO bill_rec 
  FROM public.bills b
  LEFT JOIN public.vendors v ON b.vendor_id = v.id
  WHERE b.id = b_id;

  IF bill_rec.id IS NULL OR bill_rec.status != 'approved' OR bill_rec.vendor_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.journal_entries WHERE company_id = bill_rec.company_id AND source_type = 'bill' AND source_id = b_id;

  SELECT id INTO vendor_acc_id FROM public.accounts 
  WHERE company_id = bill_rec.company_id AND name = bill_rec.vendor_name LIMIT 1;

  IF vendor_acc_id IS NULL THEN
    SELECT id INTO vendor_acc_id FROM public.accounts 
    WHERE company_id = bill_rec.company_id AND coa_id IN (
      SELECT id FROM public.chart_of_accounts WHERE company_id = bill_rec.company_id AND name = 'Trade payables'
    ) AND name = bill_rec.vendor_name LIMIT 1;
  END IF;

  IF vendor_acc_id IS NULL THEN
    DECLARE
      coa_id UUID;
    BEGIN
      SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = bill_rec.company_id AND name = 'Trade payables' LIMIT 1;
      IF coa_id IS NOT NULL THEN
        INSERT INTO public.accounts (company_id, coa_id, name) 
        VALUES (bill_rec.company_id, coa_id, bill_rec.vendor_name) 
        RETURNING id INTO vendor_acc_id;
      END IF;
    END;
  END IF;

  IF vendor_acc_id IS NULL THEN
    RETURN;
  END IF;

  -- Resolve purchase debit account
  IF bill_rec.bill_type = 'fixed_assets' THEN
    SELECT id INTO purchase_acc_id FROM public.accounts 
    WHERE company_id = bill_rec.company_id AND name = 'Other Assets' LIMIT 1;
  ELSE
    SELECT id INTO purchase_acc_id FROM public.accounts 
    WHERE company_id = bill_rec.company_id AND name = 'Purchase' LIMIT 1;
  END IF;

  IF purchase_acc_id IS NULL THEN
    SELECT id INTO purchase_acc_id FROM public.accounts 
    WHERE company_id = bill_rec.company_id AND coa_id IN (
      SELECT id FROM public.chart_of_accounts WHERE company_id = bill_rec.company_id AND account_code = '4310'
    ) LIMIT 1;
  END IF;

  SELECT id INTO vat_acc_id FROM public.accounts 
  WHERE company_id = bill_rec.company_id AND name IN ('VAT', 'VAT PAYABLE') LIMIT 1;

  SELECT id INTO tds_acc_id FROM public.accounts 
  WHERE company_id = bill_rec.company_id AND name IN ('TDS Payable') LIMIT 1;

  line_desc := 'Purchase Bill #' || COALESCE(bill_rec.bill_number, bill_rec.id::text);
  INSERT INTO public.journal_entries (company_id, date, voucher_number, narration, source_type, source_id, user_id)
  VALUES (bill_rec.company_id, COALESCE(bill_rec.invoice_date, CURRENT_DATE), 'JV-PUR-' || bill_rec.id, line_desc, 'bill', bill_rec.id, bill_rec.user_id)
  RETURNING id INTO je_id;

  -- Credit Vendor (Total Final Amount)
  INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
  VALUES (je_id, vendor_acc_id, 0.00, bill_rec.final_amount);

  -- Debit Purchase (Subtotal)
  IF purchase_acc_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je_id, purchase_acc_id, bill_rec.sub_total, 0.00);
  END IF;

  -- Debit VAT (vat_amount)
  IF bill_rec.vat_amount > 0 AND vat_acc_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je_id, vat_acc_id, bill_rec.vat_amount, 0.00);
  END IF;

  -- Credit TDS (tds_amount)
  IF bill_rec.tds_amount > 0 AND tds_acc_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je_id, tds_acc_id, 0.00, bill_rec.tds_amount);
  END IF;
END;
$$ LANGUAGE plpgsql;


-- 2. Sales Invoices
CREATE OR REPLACE FUNCTION public.post_invoice_journal_entry(inv_id UUID)
RETURNS void AS $$
DECLARE
  inv_rec RECORD;
  cust_name TEXT;
  cust_acc_id UUID;
  sales_acc_id UUID;
  vat_acc_id UUID;
  discount_acc_id UUID;
  je_id UUID;
  line_desc TEXT;
BEGIN
  SELECT si.*, c.name as cust_name 
  INTO inv_rec 
  FROM public.sales_invoices si
  LEFT JOIN public.customers c ON si.customer_id = c.id
  WHERE si.id = inv_id;

  IF inv_rec.id IS NULL OR inv_rec.status != 'final' OR inv_rec.customer_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.journal_entries WHERE company_id = inv_rec.company_id AND source_type = 'sales_invoice' AND source_id = inv_id;

  SELECT id INTO cust_acc_id FROM public.accounts 
  WHERE company_id = inv_rec.company_id AND name = inv_rec.cust_name LIMIT 1;

  IF cust_acc_id IS NULL THEN
    DECLARE
      coa_id UUID;
    BEGIN
      SELECT id INTO coa_id FROM public.chart_of_accounts WHERE company_id = inv_rec.company_id AND name = 'Trade Receivables' LIMIT 1;
      IF coa_id IS NOT NULL THEN
        INSERT INTO public.accounts (company_id, coa_id, name) 
        VALUES (inv_rec.company_id, coa_id, inv_rec.cust_name) 
        RETURNING id INTO cust_acc_id;
      END IF;
    END;
  END IF;

  IF cust_acc_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO sales_acc_id FROM public.accounts 
  WHERE company_id = inv_rec.company_id AND name = 'Sales' LIMIT 1;

  IF sales_acc_id IS NULL THEN
    SELECT id INTO sales_acc_id FROM public.accounts 
    WHERE company_id = inv_rec.company_id AND name = 'Sales' LIMIT 1;
  END IF;

  SELECT id INTO vat_acc_id FROM public.accounts 
  WHERE company_id = inv_rec.company_id AND name IN ('VAT', 'VAT PAYABLE') LIMIT 1;

  SELECT id INTO discount_acc_id FROM public.accounts 
  WHERE company_id = inv_rec.company_id AND name = 'Discount' LIMIT 1;

  line_desc := 'Sales Invoice #' || COALESCE(inv_rec.invoice_number, inv_rec.id::text);
  INSERT INTO public.journal_entries (company_id, date, voucher_number, narration, source_type, source_id, user_id)
  VALUES (inv_rec.company_id, COALESCE(inv_rec.invoice_date, CURRENT_DATE), 'JV-SAL-' || inv_rec.id, line_desc, 'sales_invoice', inv_rec.id, inv_rec.user_id)
  RETURNING id INTO je_id;

  -- Debit Customer (Total Amount)
  INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
  VALUES (je_id, cust_acc_id, inv_rec.total_amount, 0.00);

  -- Credit Sales (Subtotal)
  IF sales_acc_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je_id, sales_acc_id, 0.00, inv_rec.subtotal);
  END IF;

  -- Credit VAT (vat_amount)
  IF inv_rec.vat_amount > 0 AND vat_acc_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je_id, vat_acc_id, 0.00, inv_rec.vat_amount);
  END IF;

  -- Debit Discount (discount)
  IF inv_rec.discount > 0 AND discount_acc_id IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
    VALUES (je_id, discount_acc_id, inv_rec.discount, 0.00);
  END IF;
END;
$$ LANGUAGE plpgsql;


-- 3. Receipt Vouchers
CREATE OR REPLACE FUNCTION public.post_receipt_journal_entry(rv_id UUID)
RETURNS void AS $$
DECLARE
  rv_rec RECORD;
  cash_bank_name TEXT;
  cash_bank_acc_id UUID;
  payer_acc_id UUID;
  je_id UUID;
  line_desc TEXT;
BEGIN
  SELECT * INTO rv_rec FROM public.receipt_vouchers WHERE id = rv_id;
  IF rv_rec.id IS NULL OR rv_rec.status != 'final' THEN
    RETURN;
  END IF;

  DELETE FROM public.journal_entries WHERE company_id = rv_rec.company_id AND source_type = 'receipt_voucher' AND source_id = rv_id;

  -- 1. Find Cash/Bank Account in coa_accounts
  IF rv_rec.received_in_type = 'cash' THEN
    SELECT name INTO cash_bank_name FROM public.petty_cash_accounts WHERE id = rv_rec.received_in_id;
    SELECT id INTO cash_bank_acc_id FROM public.accounts WHERE company_id = rv_rec.company_id AND name = cash_bank_name LIMIT 1;
  ELSIF rv_rec.received_in_type = 'bank' THEN
    SELECT bank_name || ' ' || COALESCE(branch, '') || ' (' || account_number || ')' INTO cash_bank_name 
    FROM public.bank_accounts WHERE id = rv_rec.received_in_id;
    SELECT id INTO cash_bank_acc_id FROM public.accounts WHERE company_id = rv_rec.company_id AND name = cash_bank_name LIMIT 1;
  END IF;

  -- 2. Find Payer Account
  IF rv_rec.payer_type = 'customer' THEN
    DECLARE
      cust_name TEXT;
    BEGIN
      SELECT name INTO cust_name FROM public.customers WHERE id = rv_rec.customer_id;
      SELECT id INTO payer_acc_id FROM public.accounts WHERE company_id = rv_rec.company_id AND name = cust_name LIMIT 1;
    END;
  ELSE
    payer_acc_id := rv_rec.direct_account_id;
  END IF;

  IF cash_bank_acc_id IS NULL OR payer_acc_id IS NULL THEN
    RETURN;
  END IF;

  line_desc := 'Receipt Voucher #' || COALESCE(rv_rec.voucher_number, rv_rec.id::text);
  INSERT INTO public.journal_entries (company_id, date, voucher_number, narration, source_type, source_id, user_id)
  VALUES (rv_rec.company_id, COALESCE(rv_rec.receipt_date, CURRENT_DATE), 'JV-REC-' || rv_rec.id, line_desc, 'receipt_voucher', rv_rec.id, rv_rec.user_id)
  RETURNING id INTO je_id;

  -- Debit Cash/Bank
  INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
  VALUES (je_id, cash_bank_acc_id, rv_rec.total_amount, 0.00);

  -- Credit Payer Account
  INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
  VALUES (je_id, payer_acc_id, 0.00, rv_rec.total_amount);
END;
$$ LANGUAGE plpgsql;


-- 4. Payment Vouchers
CREATE OR REPLACE FUNCTION public.post_payment_journal_entry(pv_id UUID)
RETURNS void AS $$
DECLARE
  pv_rec RECORD;
  cash_bank_name TEXT;
  cash_bank_acc_id UUID;
  payee_acc_id UUID;
  je_id UUID;
  line_desc TEXT;
  pv_user_id UUID;
BEGIN
  SELECT * INTO pv_rec FROM public.payment_vouchers WHERE id = pv_id;
  IF pv_rec.id IS NULL OR pv_rec.status != 'final' THEN
    RETURN;
  END IF;

  -- Resolve user_id from company if null
  SELECT user_id INTO pv_user_id FROM public.companies WHERE id = pv_rec.company_id;

  DELETE FROM public.journal_entries WHERE company_id = pv_rec.company_id AND source_type = 'payment_voucher' AND source_id = pv_id;

  -- 1. Find Cash/Bank Account
  IF pv_rec.paid_from_type = 'cash' THEN
    SELECT name INTO cash_bank_name FROM public.petty_cash_accounts WHERE id = pv_rec.paid_from_id;
    SELECT id INTO cash_bank_acc_id FROM public.accounts WHERE company_id = pv_rec.company_id AND name = cash_bank_name LIMIT 1;
  ELSIF pv_rec.paid_from_type = 'bank' THEN
    SELECT bank_name || ' ' || COALESCE(branch, '') || ' (' || account_number || ')' INTO cash_bank_name 
    FROM public.bank_accounts WHERE id = pv_rec.paid_from_id;
    SELECT id INTO cash_bank_acc_id FROM public.accounts WHERE company_id = pv_rec.company_id AND name = cash_bank_name LIMIT 1;
  END IF;

  -- 2. Find Payee Account
  IF pv_rec.payee_type = 'vendor' THEN
    DECLARE
      vend_name TEXT;
    BEGIN
      SELECT name INTO vend_name FROM public.vendors WHERE id = pv_rec.vendor_id;
      SELECT id INTO payee_acc_id FROM public.accounts WHERE company_id = pv_rec.company_id AND name = vend_name LIMIT 1;
    END;
  ELSE
    payee_acc_id := pv_rec.direct_account_id;
  END IF;

  IF cash_bank_acc_id IS NULL OR payee_acc_id IS NULL THEN
    RETURN;
  END IF;

  line_desc := 'Payment Voucher #' || COALESCE(pv_rec.voucher_number, pv_rec.id::text);
  INSERT INTO public.journal_entries (company_id, date, voucher_number, narration, source_type, source_id, user_id)
  VALUES (pv_rec.company_id, COALESCE(pv_rec.payment_date, CURRENT_DATE), 'JV-PAY-' || pv_rec.id, line_desc, 'payment_voucher', pv_rec.id, pv_user_id)
  RETURNING id INTO je_id;

  -- Debit Vendor or Direct Account
  INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
  VALUES (je_id, payee_acc_id, pv_rec.total_amount, 0.00);

  -- Credit Cash/Bank
  INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
  VALUES (je_id, cash_bank_acc_id, 0.00, pv_rec.total_amount);
END;
$$ LANGUAGE plpgsql;


-- Triggers for Posting/Unposting on transactions Insert/Update/Delete

-- Bills
CREATE OR REPLACE FUNCTION public.trg_post_bill_je()
RETURNS trigger AS $$
BEGIN
  IF new.status = 'approved' THEN
    PERFORM public.post_bill_journal_entry(new.id);
  ELSIF new.status = 'draft' AND (old.status = 'approved' OR old IS NULL) THEN
    DELETE FROM public.journal_entries WHERE source_type = 'bill' AND source_id = new.id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bills_journal_post ON public.bills;
CREATE TRIGGER trg_bills_journal_post
  AFTER INSERT OR UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_bill_je();

-- Sales Invoices
CREATE OR REPLACE FUNCTION public.trg_post_invoice_je()
RETURNS trigger AS $$
BEGIN
  IF new.status = 'final' THEN
    PERFORM public.post_invoice_journal_entry(new.id);
  ELSIF new.status = 'draft' AND (old.status = 'final' OR old IS NULL) THEN
    DELETE FROM public.journal_entries WHERE source_type = 'sales_invoice' AND source_id = new.id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_invoices_journal_post ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_journal_post
  AFTER INSERT OR UPDATE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_invoice_je();

-- Receipt Vouchers
CREATE OR REPLACE FUNCTION public.trg_post_receipt_je()
RETURNS trigger AS $$
BEGIN
  IF new.status = 'final' THEN
    PERFORM public.post_receipt_journal_entry(new.id);
  ELSIF new.status = 'draft' AND (old.status = 'final' OR old IS NULL) THEN
    DELETE FROM public.journal_entries WHERE source_type = 'receipt_voucher' AND source_id = new.id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_receipt_vouchers_journal_post ON public.receipt_vouchers;
CREATE TRIGGER trg_receipt_vouchers_journal_post
  AFTER INSERT OR UPDATE ON public.receipt_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_receipt_je();

-- Payment Vouchers
CREATE OR REPLACE FUNCTION public.trg_post_payment_je()
RETURNS trigger AS $$
BEGIN
  IF new.status = 'final' THEN
    PERFORM public.post_payment_journal_entry(new.id);
  ELSIF new.status = 'draft' AND (old.status = 'final' OR old IS NULL) THEN
    DELETE FROM public.journal_entries WHERE source_type = 'payment_voucher' AND source_id = new.id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_vouchers_journal_post ON public.payment_vouchers;
CREATE TRIGGER trg_payment_vouchers_journal_post
  AFTER INSERT OR UPDATE ON public.payment_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_payment_je();

-- Deletes
CREATE OR REPLACE FUNCTION public.trg_delete_je_on_source_delete()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'bills' THEN
    DELETE FROM public.journal_entries WHERE source_type = 'bill' AND source_id = old.id;
  ELSIF TG_TABLE_NAME = 'sales_invoices' THEN
    DELETE FROM public.journal_entries WHERE source_type = 'sales_invoice' AND source_id = old.id;
  ELSIF TG_TABLE_NAME = 'receipt_vouchers' THEN
    DELETE FROM public.journal_entries WHERE source_type = 'receipt_voucher' AND source_id = old.id;
  ELSIF TG_TABLE_NAME = 'payment_vouchers' THEN
    DELETE FROM public.journal_entries WHERE source_type = 'payment_voucher' AND source_id = old.id;
  END IF;
  RETURN old;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bills_journal_delete ON public.bills;
CREATE TRIGGER trg_bills_journal_delete
  AFTER DELETE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.trg_delete_je_on_source_delete();

DROP TRIGGER IF EXISTS trg_sales_invoices_journal_delete ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_journal_delete
  AFTER DELETE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_delete_je_on_source_delete();

DROP TRIGGER IF EXISTS trg_receipt_vouchers_journal_delete ON public.receipt_vouchers;
CREATE TRIGGER trg_receipt_vouchers_journal_delete
  AFTER DELETE ON public.receipt_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.trg_delete_je_on_source_delete();

DROP TRIGGER IF EXISTS trg_payment_vouchers_journal_delete ON public.payment_vouchers;
CREATE TRIGGER trg_payment_vouchers_journal_delete
  AFTER DELETE ON public.payment_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.trg_delete_je_on_source_delete();


-- Backfill journal entries for existing transaction records
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Backfill bills
  FOR r IN SELECT id FROM public.bills WHERE status = 'approved' LOOP
    PERFORM public.post_bill_journal_entry(r.id);
  END LOOP;

  -- Backfill sales invoices
  FOR r IN SELECT id FROM public.sales_invoices WHERE status = 'final' LOOP
    PERFORM public.post_invoice_journal_entry(r.id);
  END LOOP;

  -- Backfill receipt vouchers
  FOR r IN SELECT id FROM public.receipt_vouchers WHERE status = 'final' LOOP
    PERFORM public.post_receipt_journal_entry(r.id);
  END LOOP;

  -- Backfill payment vouchers
  FOR r IN SELECT id FROM public.payment_vouchers WHERE status = 'final' LOOP
    PERFORM public.post_payment_journal_entry(r.id);
  END LOOP;
END $$;
