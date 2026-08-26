-- Run this in Supabase SQL Editor to add opening balance to customers and vendors
-- For customers: "receivable" means customer owes us (they have a debit balance)
-- For vendors: "payable" means we owe them (we have a payable balance)

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS opening_balance numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_type text DEFAULT 'receivable'
    CHECK (opening_balance_type IN ('receivable', 'payable'));

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS opening_balance numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_type text DEFAULT 'payable'
    CHECK (opening_balance_type IN ('payable', 'receivable'));
