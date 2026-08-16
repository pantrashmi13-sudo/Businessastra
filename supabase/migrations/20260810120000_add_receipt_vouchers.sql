-- Receipt Vouchers: for recording amounts received from customers (sales receipts)
-- Mirrors payment_vouchers structure but for incoming payments

CREATE TABLE IF NOT EXISTS public.receipt_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  voucher_number TEXT UNIQUE NOT NULL,
  payer_type TEXT NOT NULL CHECK (payer_type IN ('customer', 'other')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  payer_name TEXT,
  receipt_mode TEXT NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  adjustment_type TEXT NOT NULL DEFAULT 'simple' CHECK (adjustment_type IN ('invoice_wise', 'simple')),
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('draft', 'final')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice-wise allocations
CREATE TABLE IF NOT EXISTS public.receipt_voucher_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_voucher_id UUID NOT NULL REFERENCES public.receipt_vouchers(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  amount_applied NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_company ON public.receipt_vouchers(company_id);
CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_customer ON public.receipt_vouchers(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_date ON public.receipt_vouchers(receipt_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_vouchers_number_uidx ON public.receipt_vouchers(voucher_number);
CREATE INDEX IF NOT EXISTS idx_receipt_voucher_invoices_voucher ON public.receipt_voucher_invoices(receipt_voucher_id);
CREATE INDEX IF NOT EXISTS idx_receipt_voucher_invoices_invoice ON public.receipt_voucher_invoices(invoice_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_receipt_voucher_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS receipt_vouchers_updated_at ON public.receipt_vouchers;
CREATE TRIGGER receipt_vouchers_updated_at
  BEFORE UPDATE ON public.receipt_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_receipt_voucher_updated_at();

-- Row Level Security
ALTER TABLE public.receipt_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_voucher_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipt_vouchers_isolation" ON public.receipt_vouchers;
CREATE POLICY "receipt_vouchers_isolation" ON public.receipt_vouchers
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "receipt_voucher_invoices_isolation" ON public.receipt_voucher_invoices;
CREATE POLICY "receipt_voucher_invoices_isolation" ON public.receipt_voucher_invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.receipt_vouchers rv
      WHERE rv.id = receipt_voucher_invoices.receipt_voucher_id
        AND rv.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receipt_vouchers rv
      WHERE rv.id = receipt_voucher_invoices.receipt_voucher_id
        AND rv.user_id = auth.uid()
    )
  );
