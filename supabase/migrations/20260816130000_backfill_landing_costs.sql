-- =====================================================
-- DATA MIGRATION: Backfill Landing Costs & Stock Ledger
-- Run this AFTER the schema migration (20260816120000)
-- =====================================================

-- 1. Backfill landing_cost on existing bill_lines
-- Calculates landing cost per unit including pro-rata share of transportation & other charges
WITH line_totals AS (
  SELECT 
    bl.id AS line_id,
    bl.bill_id,
    bl.quantity,
    bl.per_unit,
    (COALESCE(bl.quantity, 0) * COALESCE(bl.per_unit, 0)) AS line_amount,
    b.transportation,
    b.other_charges,
    SUM(COALESCE(bl.quantity, 0) * COALESCE(bl.per_unit, 0)) OVER (PARTITION BY bl.bill_id) AS subtotal
  FROM bill_lines bl
  JOIN bills b ON b.id = bl.bill_id
  WHERE b.status = 'approved'
    AND bl.landing_cost = 0
),
landing_calc AS (
  SELECT 
    line_id,
    bill_id,
    quantity,
    per_unit,
    line_amount,
    transportation,
    other_charges,
    subtotal,
    CASE 
      WHEN subtotal > 0 THEN 
        line_amount / subtotal
      ELSE 0 
    END AS proportion,
    CASE 
      WHEN subtotal > 0 AND COALESCE(quantity, 0) > 0 THEN 
        (line_amount - 
          (line_amount / subtotal * COALESCE(transportation, 0)) +
          (line_amount / subtotal * COALESCE(transportation, 0)) +
          (line_amount / subtotal * COALESCE(other_charges, 0))
        ) / quantity
      ELSE per_unit 
    END AS landing_cost_per_unit
  FROM line_totals
)
UPDATE bill_lines bl
SET landing_cost = lc.landing_cost_per_unit
FROM landing_calc lc
WHERE bl.id = lc.line_id
  AND bl.landing_cost = 0;

-- 2. Populate stock_ledger with historical inward movements from approved bills
INSERT INTO stock_ledger (
  item_id,
  movement_type,
  doc_type,
  doc_id,
  doc_number,
  party_name,
  lot_number,
  expiry_date,
  quantity,
  uom,
  unit_rate,
  landing_unit_cost,
  line_amount,
  landing_total,
  running_qty,
  running_amount,
  created_at
)
SELECT 
  bl.ref_id AS item_id,
  'inward' AS movement_type,
  'bill' AS doc_type,
  b.id AS doc_id,
  COALESCE(b.bill_number, b.id::text) AS doc_number,
  COALESCE(v.name, 'Vendor') AS party_name,
  bl.lot_number,
  bl.expiry_date,
  bl.quantity,
  bl.uom,
  bl.per_unit AS unit_rate,
  COALESCE(bl.landing_cost, bl.per_unit) AS landing_unit_cost,
  bl.line_amount,
  COALESCE(bl.landing_cost, bl.per_unit) * bl.quantity AS landing_total,
  bl.quantity AS running_qty,
  COALESCE(bl.landing_cost, bl.per_unit) * bl.quantity AS running_amount,
  b.created_at
FROM bill_lines bl
JOIN bills b ON b.id = bl.bill_id
LEFT JOIN vendors v ON v.id = b.vendor_id
WHERE b.status = 'approved'
  AND bl.ref_id IS NOT NULL
  AND b.bill_number != 'OPENING-STOCK'
  AND NOT EXISTS (
    SELECT 1 FROM stock_ledger sl 
    WHERE sl.doc_type = 'bill' 
    AND sl.doc_id = b.id
  );

-- 3. Populate stock_ledger with opening stock movements
INSERT INTO stock_ledger (
  item_id,
  movement_type,
  doc_type,
  doc_id,
  doc_number,
  party_name,
  lot_number,
  expiry_date,
  quantity,
  uom,
  unit_rate,
  landing_unit_cost,
  line_amount,
  landing_total,
  running_qty,
  running_amount,
  created_at
)
SELECT 
  bl.ref_id AS item_id,
  'inward' AS movement_type,
  'opening' AS doc_type,
  b.id AS doc_id,
  'OPENING-STOCK' AS doc_number,
  'Opening Stock' AS party_name,
  bl.lot_number,
  bl.expiry_date,
  bl.quantity,
  bl.uom,
  bl.per_unit AS unit_rate,
  bl.per_unit AS landing_unit_cost,
  bl.line_amount,
  bl.per_unit * bl.quantity AS landing_total,
  bl.quantity AS running_qty,
  bl.per_unit * bl.quantity AS running_amount,
  b.created_at
FROM bill_lines bl
JOIN bills b ON b.id = bl.bill_id
WHERE b.bill_number = 'OPENING-STOCK'
  AND bl.ref_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM stock_ledger sl 
    WHERE sl.doc_type = 'opening' 
    AND sl.doc_id = b.id
  );

-- 4. Populate stock_ledger with outward movements from delivery challans
INSERT INTO stock_ledger (
  item_id,
  movement_type,
  doc_type,
  doc_id,
  doc_number,
  party_name,
  lot_number,
  expiry_date,
  quantity,
  uom,
  unit_rate,
  landing_unit_cost,
  line_amount,
  landing_total,
  running_qty,
  running_amount,
  created_at
)
SELECT 
  dcl.ref_id AS item_id,
  'outward' AS movement_type,
  'challan' AS doc_type,
  dc.id AS doc_id,
  dc.challan_number AS doc_number,
  COALESCE(c.name, 'Customer') AS party_name,
  dcl.lot_number,
  dcl.expiry_date,
  dcl.quantity,
  dcl.uom,
  dcl.per_unit AS unit_rate,
  COALESCE(dcl.landing_cost, dcl.per_unit) AS landing_unit_cost,
  dcl.line_amount,
  COALESCE(dcl.landing_cost, dcl.per_unit) * dcl.quantity AS landing_total,
  -dcl.quantity AS running_qty,
  -(COALESCE(dcl.landing_cost, dcl.per_unit) * dcl.quantity) AS running_amount,
  dc.created_at
FROM delivery_challan_lines dcl
JOIN delivery_challans dc ON dc.id = dcl.challan_id
LEFT JOIN customers c ON c.id = dc.customer_id
WHERE dc.status IN ('dispatched', 'delivered')
  AND dcl.ref_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM stock_ledger sl 
    WHERE sl.doc_type = 'challan' 
    AND sl.doc_id = dc.id
  );

-- 5. Update stock_ledger with correct running totals per item
-- This recalculates running_qty and running_amount based on chronological order
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
    item_id,
    movement_type,
    quantity,
    landing_total,
    SUM(CASE 
      WHEN movement_type = 'inward' THEN quantity 
      ELSE -quantity 
    END) OVER (PARTITION BY item_id ORDER BY rn) AS running_qty,
    SUM(CASE 
      WHEN movement_type = 'inward' THEN landing_total 
      ELSE -landing_total 
    END) OVER (PARTITION BY item_id ORDER BY rn) AS running_amount
  FROM ordered_movements
)
UPDATE stock_ledger sl
SET 
  running_qty = rt.running_qty,
  running_amount = rt.running_amount
FROM running_totals rt
WHERE sl.id = rt.id;

-- 6. Update delivery_challan_lines landing_cost if not set
-- Uses the weighted average cost from stock_ledger for the item
UPDATE delivery_challan_lines dcl
SET landing_cost = (
  SELECT 
    CASE 
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

-- Verify migration results
DO $$
DECLARE
  bill_lines_updated INTEGER;
  stock_ledger_count INTEGER;
  challan_lines_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO bill_lines_updated FROM bill_lines WHERE landing_cost > 0;
  SELECT COUNT(*) INTO stock_ledger_count FROM stock_ledger;
  SELECT COUNT(*) INTO challan_lines_updated FROM delivery_challan_lines WHERE landing_cost > 0;
  
  RAISE NOTICE 'Migration Complete!';
  RAISE NOTICE 'Bill lines with landing cost: %', bill_lines_updated;
  RAISE NOTICE 'Stock ledger entries created: %', stock_ledger_count;
  RAISE NOTICE 'Delivery challan lines with landing cost: %', challan_lines_updated;
END $$;
