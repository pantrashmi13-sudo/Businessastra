-- Add payment_terms_days to customers for overdue calculation
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT 30;
