-- =====================================================
-- MIGRATION: Auto-generate lot numbers for existing records
-- Run this AFTER the main landing cost migration
-- =====================================================

-- 1. Update bill_lines: Generate lot numbers for NULL lot_number entries
UPDATE bill_lines bl
SET lot_number = 'LOT-' || COALESCE(
  (SELECT b.bill_number FROM bills b WHERE b.id = bl.bill_id), 
  bl.bill_id::text
) || '-' || COALESCE(
  UPPER(REPLACE(SUBSTRING(bl.name FROM 1 FOR 10), ' ', '')),
  'ITEM'
) || '-' || LPAD(bl.sno::text, 3, '0')
WHERE bl.lot_number IS NULL 
   OR TRIM(bl.lot_number) = '';

-- 2. Update delivery_challan_lines: Generate lot numbers for NULL lot_number entries
UPDATE delivery_challan_lines dcl
SET lot_number = 'LOT-' || COALESCE(
  (SELECT dc.challan_number FROM delivery_challans dc WHERE dc.id = dcl.challan_id), 
  dcl.challan_id::text
) || '-' || COALESCE(
  UPPER(REPLACE(SUBSTRING(dcl.name FROM 1 FOR 10), ' ', '')),
  'ITEM'
) || '-' || LPAD(dcl.sno::text, 3, '0')
WHERE dcl.lot_number IS NULL 
   OR TRIM(dcl.lot_number) = '';

-- Verify
SELECT 
  (SELECT COUNT(*) FROM bill_lines WHERE lot_number IS NOT NULL AND lot_number != '') AS bill_lines_with_lots,
  (SELECT COUNT(*) FROM delivery_challan_lines WHERE lot_number IS NOT NULL AND lot_number != '') AS challan_lines_with_lots;
