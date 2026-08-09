-- Migration to enforce multi-tenant isolation on payment_vouchers and payment_voucher_bills
-- Date: 2026-08-09

-- 1. Add user_id column to public.payment_vouchers
ALTER TABLE public.payment_vouchers 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- 2. Revoke all privileges from anon role
REVOKE ALL ON public.payment_vouchers FROM anon;
REVOKE ALL ON public.payment_voucher_bills FROM anon;

-- 3. Drop broad public access policies
DROP POLICY IF EXISTS "public all payment_vouchers" ON public.payment_vouchers;
DROP POLICY IF EXISTS "public all payment_voucher_bills" ON public.payment_voucher_bills;

-- 4. Create tenant-isolated policy for payment_vouchers
CREATE POLICY "Tenant isolation for payment_vouchers" ON public.payment_vouchers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Create tenant-isolated policy for payment_voucher_bills
CREATE POLICY "Tenant isolation for payment_voucher_bills" ON public.payment_voucher_bills
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_vouchers v WHERE v.id = payment_voucher_bills.payment_voucher_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.payment_vouchers v WHERE v.id = payment_voucher_bills.payment_voucher_id AND v.user_id = auth.uid()));
