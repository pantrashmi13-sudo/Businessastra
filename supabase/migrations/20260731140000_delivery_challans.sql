-- Migration: Delivery Challans (Outward Material Movement)

CREATE TYPE public.challan_status AS ENUM ('draft', 'dispatched', 'delivered', 'cancelled');

CREATE TABLE IF NOT EXISTS public.delivery_challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  challan_number TEXT NOT NULL UNIQUE,
  challan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  po_reference TEXT,
  delivery_address TEXT,
  vehicle_number TEXT,
  driver_contact TEXT,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.challan_status NOT NULL DEFAULT 'dispatched',
  notes TEXT,
  dispatched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_challans TO anon, authenticated;
GRANT ALL ON public.delivery_challans TO service_role;
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all delivery_challans" ON public.delivery_challans FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_challans_customer ON public.delivery_challans (customer_id);
CREATE INDEX IF NOT EXISTS idx_challans_number ON public.delivery_challans (challan_number);

CREATE TABLE IF NOT EXISTS public.delivery_challan_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID NOT NULL REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
  sno INT NOT NULL DEFAULT 1,
  ref_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  code TEXT,
  name TEXT NOT NULL,
  uom TEXT DEFAULT 'NOS',
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  per_unit NUMERIC(14,2) NOT NULL DEFAULT 0,
  lot_number TEXT,
  expiry_date DATE,
  line_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_challan_lines TO anon, authenticated;
GRANT ALL ON public.delivery_challan_lines TO service_role;
ALTER TABLE public.delivery_challan_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all delivery_challan_lines" ON public.delivery_challan_lines FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_challan_lines_challan ON public.delivery_challan_lines (challan_id);
CREATE INDEX IF NOT EXISTS idx_challan_lines_ref ON public.delivery_challan_lines (ref_id);
