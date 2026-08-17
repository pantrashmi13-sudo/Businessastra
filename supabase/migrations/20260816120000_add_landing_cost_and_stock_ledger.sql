-- Add landing_cost column to bill_lines to store per-unit landing cost including transportation and other charges
ALTER TABLE bill_lines ADD COLUMN IF NOT EXISTS landing_cost NUMERIC(15,2) DEFAULT 0;

-- Create stock_ledger table for persistent movement tracking with landing costs
CREATE TABLE IF NOT EXISTS stock_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('inward', 'outward')),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('bill', 'challan', 'consumption', 'opening')),
  doc_id UUID NOT NULL,
  doc_number TEXT,
  party_name TEXT,
  lot_number TEXT,
  expiry_date DATE,
  quantity NUMERIC(15,3) NOT NULL,
  uom TEXT DEFAULT 'NOS',
  unit_rate NUMERIC(15,2) DEFAULT 0,
  landing_unit_cost NUMERIC(15,2) DEFAULT 0,
  line_amount NUMERIC(15,2) DEFAULT 0,
  landing_total NUMERIC(15,2) DEFAULT 0,
  running_qty NUMERIC(15,3) DEFAULT 0,
  running_amount NUMERIC(15,2) DEFAULT 0,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_ledger_item_id ON stock_ledger(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_movement_type ON stock_ledger(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_lot_number ON stock_ledger(lot_number);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_doc_type_doc_id ON stock_ledger(doc_type, doc_id);

-- Add landing_cost to delivery_challan_lines for consistency
ALTER TABLE delivery_challan_lines ADD COLUMN IF NOT EXISTS landing_cost NUMERIC(15,2) DEFAULT 0;
