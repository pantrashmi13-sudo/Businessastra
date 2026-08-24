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

-- Enable RLS
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- RLS policies for warehouses
CREATE POLICY "Users can view their company warehouses" 
ON warehouses FOR SELECT 
TO authenticated 
USING (company_id IN (
  SELECT company_id FROM user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert warehouses for their company" 
ON warehouses FOR INSERT 
TO authenticated 
WITH CHECK (company_id IN (
  SELECT company_id FROM user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update their company warehouses" 
ON warehouses FOR UPDATE 
TO authenticated 
USING (company_id IN (
  SELECT company_id FROM user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete their company warehouses" 
ON warehouses FOR DELETE 
TO authenticated 
USING (company_id IN (
  SELECT company_id FROM user_roles WHERE user_id = auth.uid()
));

-- 2. Add warehouse_id to items and rag_number
ALTER TABLE items ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS rag_number TEXT;

-- 3. Add warehouse_id to stock_ledger
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE;

-- 4. Add warehouse_id to bill_lines, challan_lines, sales_invoice_lines, purchase_return_lines, sales_return_lines
ALTER TABLE bill_lines ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE challan_lines ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE sales_invoice_lines ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE purchase_return_lines ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE sales_return_lines ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- 5. Data Migration: Create "Main Warehouse" for existing companies and backfill items & stock_ledger
DO $$
DECLARE
  comp RECORD;
  wh_id UUID;
BEGIN
  FOR comp IN SELECT id FROM companies LOOP
    -- Check if Main Warehouse already exists for this company
    SELECT id INTO wh_id FROM warehouses WHERE company_id = comp.id AND name = 'Main Warehouse';
    
    IF wh_id IS NULL THEN
      -- Create it
      INSERT INTO warehouses (company_id, name, location) 
      VALUES (comp.id, 'Main Warehouse', 'HQ') 
      RETURNING id INTO wh_id;
    END IF;

    -- Update items that don't have warehouse_id but belong to this company
    UPDATE items SET warehouse_id = wh_id WHERE company_id = comp.id AND warehouse_id IS NULL;
    
    -- Update stock_ledger for this company
    UPDATE stock_ledger SET warehouse_id = wh_id WHERE company_id = comp.id AND warehouse_id IS NULL;

    -- Update bill_lines
    UPDATE bill_lines SET warehouse_id = wh_id WHERE bill_id IN (SELECT id FROM bills WHERE company_id = comp.id) AND warehouse_id IS NULL;
    
    -- Update challan_lines
    UPDATE challan_lines SET warehouse_id = wh_id WHERE challan_id IN (SELECT id FROM challans WHERE company_id = comp.id) AND warehouse_id IS NULL;
  END LOOP;
END $$;
