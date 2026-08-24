-- Fix stock_ledger CHECK constraint to allow purchase_return and sales_return doc_types
ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_doc_type_check;
ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_doc_type_check 
  CHECK (doc_type IN ('bill', 'challan', 'consumption', 'opening', 'purchase_return', 'sales_return'));

-- Ensure authenticated role can insert into stock_ledger
GRANT SELECT, INSERT, UPDATE ON stock_ledger TO authenticated;
