-- 1. Create warehouse_rags table (Rack/Aisle/Grid locations within a warehouse)
CREATE TABLE IF NOT EXISTS warehouse_rags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  capacity NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(warehouse_id, name)
);

ALTER TABLE warehouse_rags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company warehouse_rags"
ON warehouse_rags FOR SELECT
TO authenticated
USING (warehouse_id IN (
  SELECT id FROM warehouses WHERE company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can insert warehouse_rags for their company"
ON warehouse_rags FOR INSERT
TO authenticated
WITH CHECK (warehouse_id IN (
  SELECT id FROM warehouses WHERE company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can update their company warehouse_rags"
ON warehouse_rags FOR UPDATE
TO authenticated
USING (warehouse_id IN (
  SELECT id FROM warehouses WHERE company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can delete their company warehouse_rags"
ON warehouse_rags FOR DELETE
TO authenticated
USING (warehouse_id IN (
  SELECT id FROM warehouses WHERE company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  )
));

-- 2. Add rag_id to items table (FK to warehouse_rags, optional)
ALTER TABLE items ADD COLUMN IF NOT EXISTS rag_id UUID REFERENCES warehouse_rags(id) ON DELETE SET NULL;

-- 3. Create stock_transfers table
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_number TEXT NOT NULL,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),
  notes TEXT,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company stock_transfers"
ON stock_transfers FOR SELECT
TO authenticated
USING (company_id IN (
  SELECT company_id FROM user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert stock_transfers for their company"
ON stock_transfers FOR INSERT
TO authenticated
WITH CHECK (company_id IN (
  SELECT company_id FROM user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update their company stock_transfers"
ON stock_transfers FOR UPDATE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete their company stock_transfers"
ON stock_transfers FOR DELETE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM user_roles WHERE user_id = auth.uid()
));

-- 4. Create stock_transfer_lines table
CREATE TABLE IF NOT EXISTS stock_transfer_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  from_rag_id UUID REFERENCES warehouse_rags(id) ON DELETE SET NULL,
  to_rag_id UUID REFERENCES warehouse_rags(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE stock_transfer_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company stock_transfer_lines"
ON stock_transfer_lines FOR SELECT
TO authenticated
USING (transfer_id IN (
  SELECT id FROM stock_transfers WHERE company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can insert stock_transfer_lines for their company"
ON stock_transfer_lines FOR INSERT
TO authenticated
WITH CHECK (transfer_id IN (
  SELECT id FROM stock_transfers WHERE company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can update their company stock_transfer_lines"
ON stock_transfer_lines FOR UPDATE
TO authenticated
USING (transfer_id IN (
  SELECT id FROM stock_transfers WHERE company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can delete their company stock_transfer_lines"
ON stock_transfer_lines FOR DELETE
TO authenticated
USING (transfer_id IN (
  SELECT id FROM stock_transfers WHERE company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  )
));

-- 5. Add 'transfer' to stock_ledger doc_type check constraint
ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_doc_type_check;
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_doc_type_check
  CHECK (doc_type IN ('bill', 'challan', 'consumption', 'opening', 'purchase_return', 'sales_return', 'transfer'));

-- 6. Add warehouse_id to delivery_challans
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
