-- Create consumptions table for tracking internal usage of other items
CREATE TABLE IF NOT EXISTS public.consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumption_number text NOT NULL,
  consumption_date text,
  notes text,
  company_id uuid,
  status text NOT NULL DEFAULT 'final',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create consumption_lines table for line items
CREATE TABLE IF NOT EXISTS public.consumption_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumption_id uuid NOT NULL REFERENCES public.consumptions(id) ON DELETE CASCADE,
  sno integer NOT NULL,
  ref_id uuid REFERENCES public.items(id),
  code text,
  name text NOT NULL,
  uom text DEFAULT 'NOS',
  quantity numeric NOT NULL DEFAULT 1,
  per_unit numeric DEFAULT 0,
  line_amount numeric GENERATED ALWAYS AS (quantity * per_unit) STORED,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumption_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow all for authenticated" ON public.consumptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.consumption_lines FOR ALL USING (true) WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consumptions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consumption_lines TO anon, authenticated;

-- Indexes
CREATE INDEX idx_consumptions_company ON public.consumptions(company_id);
CREATE INDEX idx_consumption_lines_consumption ON public.consumption_lines(consumption_id);
CREATE INDEX idx_consumption_lines_ref ON public.consumption_lines(ref_id);

-- Updated_at trigger
CREATE TRIGGER consumptions_updated BEFORE UPDATE ON public.consumptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
