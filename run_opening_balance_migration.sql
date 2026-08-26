-- Run this in Supabase SQL Editor
-- Adds opening_balance, opening_balance_type, and payment_terms_days to customers & vendors

-- ── CUSTOMERS ────────────────────────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS opening_balance     numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_type text         DEFAULT 'receivable'
    CHECK (opening_balance_type IN ('receivable', 'payable')),
  ADD COLUMN IF NOT EXISTS payment_terms_days  integer       DEFAULT 0;

-- ── VENDORS ──────────────────────────────────────────────────────────────────
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS opening_balance     numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_type text         DEFAULT 'payable'
    CHECK (opening_balance_type IN ('payable', 'receivable'));
