-- Sales Invoices: generated from Delivery Challans (PAN or VAT format)
-- Tenant isolation via user_id, same pattern as delivery_challans

CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('pan', 'vat')),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  challan_ids UUID[] DEFAULT '{}',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Line items for sales invoices
CREATE TABLE IF NOT EXISTS public.sales_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  sno INTEGER NOT NULL DEFAULT 1,
  ref_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  code TEXT,
  name TEXT NOT NULL,
  uom TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  per_unit NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 0,
  line_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_invoices_user ON public.sales_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON public.sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_company ON public.sales_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_number ON public.sales_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_lines_invoice ON public.sales_invoice_lines(invoice_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_sales_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sales_invoices_updated_at ON public.sales_invoices;
CREATE TRIGGER sales_invoices_updated_at
  BEFORE UPDATE ON public.sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sales_invoice_updated_at();

-- Row Level Security (tenant isolation)
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_lines ENABLE ROW LEVEL SECURITY;

-- sales_invoices policies
DROP POLICY IF EXISTS "sales_invoices_isolation" ON public.sales_invoices;
CREATE POLICY "sales_invoices_isolation" ON public.sales_invoices
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- sales_invoice_lines policies (via join to sales_invoices for user check)
DROP POLICY IF EXISTS "sales_invoice_lines_isolation" ON public.sales_invoice_lines;
CREATE POLICY "sales_invoice_lines_isolation" ON public.sales_invoice_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_invoices si
      WHERE si.id = sales_invoice_lines.invoice_id
        AND si.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_invoices si
      WHERE si.id = sales_invoice_lines.invoice_id
        AND si.user_id = auth.uid()
    )
  );
