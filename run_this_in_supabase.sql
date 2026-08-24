-- ============================================================
-- WAREHOUSE MANAGEMENT MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  incharge_person TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Enable RLS with simple open policy (matches project pattern)
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all warehouses" ON warehouses FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO anon, authenticated;
GRANT ALL ON public.warehouses TO service_role;

-- 2. Add warehouse_id and rag_number to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS rag_number TEXT;

-- 3. Add warehouse_id to stock_ledger
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- 4. Add warehouse_id to transaction lines
ALTER TABLE bill_lines ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE delivery_challan_lines ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- 5. Backfill: Create "Main Warehouse" for each company
-- Note: items table has no company_id (items are global), so we just create
-- a Main Warehouse per company and link bill_lines/challan_lines
DO $$
DECLARE
  comp RECORD;
  wh_id UUID;
BEGIN
  FOR comp IN SELECT id FROM companies LOOP
    SELECT id INTO wh_id FROM warehouses WHERE company_id = comp.id AND name = 'Main Warehouse';

    IF wh_id IS NULL THEN
      INSERT INTO warehouses (company_id, name, location)
      VALUES (comp.id, 'Main Warehouse', 'HQ')
      RETURNING id INTO wh_id;
    END IF;

    -- Backfill bill_lines for this company's bills
    UPDATE bill_lines SET warehouse_id = wh_id
      WHERE bill_id IN (SELECT id FROM bills WHERE company_id = comp.id)
      AND warehouse_id IS NULL;

    -- Backfill delivery_challan_lines for this company's challans
    UPDATE delivery_challan_lines SET warehouse_id = wh_id
      WHERE challan_id IN (SELECT id FROM delivery_challans WHERE company_id = comp.id)
      AND warehouse_id IS NULL;

    -- Backfill stock_ledger for this company's entries
    UPDATE stock_ledger SET warehouse_id = wh_id
      WHERE company_id = comp.id
      AND warehouse_id IS NULL;

  END LOOP;
END $$;
