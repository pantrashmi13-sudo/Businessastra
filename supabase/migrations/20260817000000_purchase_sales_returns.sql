-- Purchase Returns and Sales Returns tables
-- Created: 2026-08-17

-- ============================================================
-- PURCHASE RETURNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT UNIQUE NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  original_bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE RESTRICT,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  sno INTEGER NOT NULL DEFAULT 1,
  ref_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  code TEXT,
  name TEXT NOT NULL,
  uom TEXT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  original_per_unit NUMERIC(14,2) NOT NULL DEFAULT 0,
  per_unit NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for purchase_returns
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_returns_select" ON public.purchase_returns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "purchase_returns_insert" ON public.purchase_returns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "purchase_returns_update" ON public.purchase_returns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "purchase_returns_delete" ON public.purchase_returns FOR DELETE USING (auth.uid() = user_id);

-- RLS for purchase_return_lines (check via parent return)
ALTER TABLE public.purchase_return_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_return_lines_select" ON public.purchase_return_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.purchase_returns WHERE id = return_id AND user_id = auth.uid())
);
CREATE POLICY "purchase_return_lines_insert" ON public.purchase_return_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.purchase_returns WHERE id = return_id AND user_id = auth.uid())
);
CREATE POLICY "purchase_return_lines_update" ON public.purchase_return_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.purchase_returns WHERE id = return_id AND user_id = auth.uid())
);
CREATE POLICY "purchase_return_lines_delete" ON public.purchase_return_lines FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.purchase_returns WHERE id = return_id AND user_id = auth.uid())
);

-- ============================================================
-- SALES RETURNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT UNIQUE NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  original_invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  sno INTEGER NOT NULL DEFAULT 1,
  ref_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  code TEXT,
  name TEXT NOT NULL,
  uom TEXT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  original_per_unit NUMERIC(14,2) NOT NULL DEFAULT 0,
  per_unit NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for sales_returns
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_returns_select" ON public.sales_returns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sales_returns_insert" ON public.sales_returns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sales_returns_update" ON public.sales_returns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sales_returns_delete" ON public.sales_returns FOR DELETE USING (auth.uid() = user_id);

-- RLS for sales_return_lines (check via parent return)
ALTER TABLE public.sales_return_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_return_lines_select" ON public.sales_return_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sales_returns WHERE id = return_id AND user_id = auth.uid())
);
CREATE POLICY "sales_return_lines_insert" ON public.sales_return_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sales_returns WHERE id = return_id AND user_id = auth.uid())
);
CREATE POLICY "sales_return_lines_update" ON public.sales_return_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.sales_returns WHERE id = return_id AND user_id = auth.uid())
);
CREATE POLICY "sales_return_lines_delete" ON public.sales_return_lines FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.sales_returns WHERE id = return_id AND user_id = auth.uid())
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_purchase_returns_original_bill ON public.purchase_returns(original_bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_vendor ON public.purchase_returns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_lines_return ON public.purchase_return_lines(return_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_original_invoice ON public.sales_returns(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON public.sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_lines_return ON public.sales_return_lines(return_id);

-- ============================================================
-- TRIGGERS for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_purchase_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_purchase_returns_updated_at
  BEFORE UPDATE ON public.purchase_returns
  FOR EACH ROW EXECUTE FUNCTION update_purchase_returns_updated_at();

CREATE OR REPLACE FUNCTION update_sales_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_returns_updated_at
  BEFORE UPDATE ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION update_sales_returns_updated_at();
