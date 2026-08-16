-- Add paid_from columns to payment_vouchers
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS paid_from_type TEXT;
ALTER TABLE public.payment_vouchers ADD COLUMN IF NOT EXISTS paid_from_id UUID;

-- Add received_in columns to receipt_vouchers
ALTER TABLE public.receipt_vouchers ADD COLUMN IF NOT EXISTS received_in_type TEXT;
ALTER TABLE public.receipt_vouchers ADD COLUMN IF NOT EXISTS received_in_id UUID;
