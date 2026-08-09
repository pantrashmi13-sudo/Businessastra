-- Create enum types for payment vouchers
DO $$ BEGIN
  CREATE TYPE public.payee_type AS ENUM ('vendor', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_adjustment_type AS ENUM ('bill_wise', 'simple');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.voucher_status AS ENUM ('draft', 'final');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create payment_vouchers table
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  voucher_number TEXT NOT NULL,
  payee_type public.payee_type NOT NULL DEFAULT 'vendor',
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  payee_name TEXT,
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  adjustment_type public.payment_adjustment_type NOT NULL DEFAULT 'simple',
  remarks TEXT,
  status public.voucher_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payment_voucher_bills table for bill-wise adjustments
CREATE TABLE IF NOT EXISTS public.payment_voucher_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_voucher_id UUID NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount_applied NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_company ON public.payment_vouchers (company_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_vendor ON public.payment_vouchers (vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_date ON public.payment_vouchers (payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_voucher_bills_voucher ON public.payment_voucher_bills (payment_voucher_id);
CREATE INDEX IF NOT EXISTS idx_payment_voucher_bills_bill ON public.payment_voucher_bills (bill_id);

-- Create unique index for voucher_number per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_vouchers_voucher_number_uidx
  ON public.payment_vouchers (company_id, voucher_number);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_vouchers TO anon, authenticated;
GRANT ALL ON public.payment_vouchers TO service_role;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_voucher_bills TO anon, authenticated;
GRANT ALL ON public.payment_voucher_bills TO service_role;
ALTER TABLE public.payment_voucher_bills ENABLE ROW LEVEL SECURITY;

-- Create policies for full public access (matching other tables)
CREATE POLICY "public all payment_vouchers" ON public.payment_vouchers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all payment_voucher_bills" ON public.payment_voucher_bills FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for setting updated_at on payment_vouchers table
CREATE TRIGGER trg_payment_vouchers_updated
  BEFORE UPDATE ON public.payment_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
