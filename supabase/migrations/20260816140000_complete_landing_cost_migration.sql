-- =====================================================
-- COMPLETE MIGRATION: Landing Costs & Stock Ledger
-- Run this SINGLE file in Supabase SQL Editor
-- =====================================================

-- STEP 1: Add landing_cost column to bill_lines
ALTER TABLE bill_lines ADD COLUMN IF NOT EXISTS landing_cost NUMERIC(15,2) DEFAULT 0;

-- STEP 2: Add landing_cost to delivery_challan_lines
ALTER TABLE delivery_challan_lines ADD COLUMN IF NOT EXISTS landing_cost NUMERIC(15,2) DEFAULT 0;

-- STEP 3: Create stock_ledger table WITHOUT foreign key constraint first
CREATE TABLE IF NOT EXISTS stock_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL,
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

-- STEP 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_ledger_item_id ON stock_ledger(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_movement_type ON stock_ledger(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_lot_number ON stock_ledger(lot_number);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_doc_type_doc_id ON stock_ledger(doc_type, doc_id);

-- STEP 5: Backfill landing_cost on existing bill_lines
UPDATE bill_lines bl
SET landing_cost = CASE 
  WHEN COALESCE(bl.quantity, 0) > 0 THEN bl.line_amount / bl.quantity
  ELSE bl.per_unit
END
FROM bills b
WHERE b.id = bl.bill_id
  AND b.status = 'approved'
  AND bl.landing_cost = 0
  AND bl.line_amount > 0;

-- STEP 6: Populate stock_ledger with inward movements from bills
-- Only include items that exist in the items table
INSERT INTO stock_ledger (
  item_id, movement_type, doc_type, doc_id, doc_number,
  party_name, lot_number, expiry_date, quantity, uom,
  unit_rate, landing_unit_cost, line_amount, landing_total,
  running_qty, running_amount, created_at
)
SELECT 
  bl.ref_id,
  'inward',
  'bill',
  b.id,
  COALESCE(b.bill_number, b.id::text),
  COALESCE(v.name, 'Vendor'),
  bl.lot_number,
  bl.expiry_date,
  bl.quantity,
  bl.uom,
  bl.per_unit,
  COALESCE(bl.landing_cost, bl.per_unit),
  bl.line_amount,
  COALESCE(bl.landing_cost, bl.per_unit) * bl.quantity,
  bl.quantity,
  COALESCE(bl.landing_cost, bl.per_unit) * bl.quantity,
  b.created_at
FROM bill_lines bl
JOIN bills b ON b.id = bl.bill_id
LEFT JOIN vendors v ON v.id = b.vendor_id
WHERE b.status = 'approved'
  AND bl.ref_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM items i WHERE i.id = bl.ref_id)
  AND NOT EXISTS (
    SELECT 1 FROM stock_ledger sl 
    WHERE sl.doc_type = 'bill' AND sl.doc_id = b.id
  );

-- STEP 7: Populate stock_ledger with opening stock
INSERT INTO stock_ledger (
  item_id, movement_type, doc_type, doc_id, doc_number,
  party_name, lot_number, expiry_date, quantity, uom,
  unit_rate, landing_unit_cost, line_amount, landing_total,
  running_qty, running_amount, created_at
)
SELECT 
  bl.ref_id,
  'inward',
  'opening',
  b.id,
  'OPENING-STOCK',
  'Opening Stock',
  bl.lot_number,
  bl.expiry_date,
  bl.quantity,
  bl.uom,
  bl.per_unit,
  bl.per_unit,
  bl.line_amount,
  bl.per_unit * bl.quantity,
  bl.quantity,
  bl.per_unit * bl.quantity,
  b.created_at
FROM bill_lines bl
JOIN bills b ON b.id = bl.bill_id
WHERE b.bill_number = 'OPENING-STOCK'
  AND bl.ref_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM items i WHERE i.id = bl.ref_id)
  AND NOT EXISTS (
    SELECT 1 FROM stock_ledger sl 
    WHERE sl.doc_type = 'opening' AND sl.doc_id = b.id
  );

-- STEP 8: Populate stock_ledger with outward movements
INSERT INTO stock_ledger (
  item_id, movement_type, doc_type, doc_id, doc_number,
  party_name, lot_number, expiry_date, quantity, uom,
  unit_rate, landing_unit_cost, line_amount, landing_total,
  running_qty, running_amount, created_at
)
SELECT 
  dcl.ref_id,
  'outward',
  'challan',
  dc.id,
  dc.challan_number,
  COALESCE(c.name, 'Customer'),
  dcl.lot_number,
  dcl.expiry_date,
  dcl.quantity,
  dcl.uom,
  dcl.per_unit,
  COALESCE(dcl.landing_cost, dcl.per_unit),
  dcl.line_amount,
  COALESCE(dcl.landing_cost, dcl.per_unit) * dcl.quantity,
  -dcl.quantity,
  -(COALESCE(dcl.landing_cost, dcl.per_unit) * dcl.quantity),
  dc.created_at
FROM delivery_challan_lines dcl
JOIN delivery_challans dc ON dc.id = dcl.challan_id
LEFT JOIN customers c ON c.id = dc.customer_id
WHERE dc.status IN ('dispatched', 'delivered')
  AND dcl.ref_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM items i WHERE i.id = dcl.ref_id)
  AND NOT EXISTS (
    SELECT 1 FROM stock_ledger sl 
    WHERE sl.doc_type = 'challan' AND sl.doc_id = dc.id
  );

-- STEP 9: Update running totals per item chronologically
WITH ordered_movements AS (
  SELECT 
    id,
    item_id,
    movement_type,
    quantity,
    landing_total,
    ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY created_at, id) AS rn
  FROM stock_ledger
),
running_totals AS (
  SELECT 
    id,
    SUM(CASE WHEN movement_type = 'inward' THEN quantity ELSE -quantity END) 
      OVER (PARTITION BY item_id ORDER BY rn) AS running_qty,
    SUM(CASE WHEN movement_type = 'inward' THEN landing_total ELSE -landing_total END) 
      OVER (PARTITION BY item_id ORDER BY rn) AS running_amount
  FROM ordered_movements
)
UPDATE stock_ledger sl
SET running_qty = rt.running_qty,
    running_amount = rt.running_amount
FROM running_totals rt
WHERE sl.id = rt.id;

-- STEP 10: Update delivery_challan_lines landing_cost with weighted average
UPDATE delivery_challan_lines dcl
SET landing_cost = (
  SELECT CASE 
    WHEN SUM(CASE WHEN sl.movement_type = 'inward' THEN sl.quantity ELSE 0 END) > 0 THEN
      SUM(CASE WHEN sl.movement_type = 'inward' THEN sl.landing_total ELSE 0 END) /
      SUM(CASE WHEN sl.movement_type = 'inward' THEN sl.quantity ELSE 0 END)
    ELSE dcl.per_unit
  END
  FROM stock_ledger sl
  WHERE sl.item_id = dcl.ref_id
    AND sl.movement_type = 'inward'
)
WHERE dcl.landing_cost = 0
  AND dcl.ref_id IS NOT NULL;

-- Verify
SELECT 
  (SELECT COUNT(*) FROM bill_lines WHERE landing_cost > 0) AS bill_lines_with_landing_cost,
  (SELECT COUNT(*) FROM stock_ledger) AS stock_ledger_entries,
  (SELECT COUNT(*) FROM delivery_challan_lines WHERE landing_cost > 0) AS challan_lines_with_landing_cost;
