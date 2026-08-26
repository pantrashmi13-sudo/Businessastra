-- Add opening balance fields to customers and vendors
-- For customers: type is "receivable" (they owe us) or "payable" (we owe them, e.g. advance)
-- For vendors: type is "payable" (we owe them) or "receivable" (they owe us, e.g. advance)

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS opening_balance numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_type text DEFAULT 'receivable'
    CHECK (opening_balance_type IN ('receivable', 'payable'));

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS opening_balance numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_type text DEFAULT 'payable'
    CHECK (opening_balance_type IN ('payable', 'receivable'));
