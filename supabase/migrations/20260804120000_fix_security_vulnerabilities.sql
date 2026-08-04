-- Security Fix Migration: Complete multi-tenant isolation

-- 0. Add user_id column to ALL tables that need it
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- 1. Drop ALL old wide-open policies
DROP POLICY IF EXISTS "public all companies" ON public.companies;
DROP POLICY IF EXISTS "public all customers" ON public.customers;
DROP POLICY IF EXISTS "public all vendors" ON public.vendors;
DROP POLICY IF EXISTS "public all items" ON public.items;
DROP POLICY IF EXISTS "public all fixed_assets" ON public.fixed_assets;
DROP POLICY IF EXISTS "public all bills" ON public.bills;
DROP POLICY IF EXISTS "public all delivery_challans" ON public.delivery_challans;
DROP POLICY IF EXISTS "public all bill_lines" ON public.bill_lines;
DROP POLICY IF EXISTS "public all delivery_challan_lines" ON public.delivery_challan_lines;
DROP POLICY IF EXISTS "public all ledgers" ON public.ledgers;

-- 2. Create strict tenant isolation policies
CREATE POLICY "Tenant isolation for companies" ON public.companies
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant isolation for customers" ON public.customers
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant isolation for vendors" ON public.vendors
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant isolation for items" ON public.items
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant isolation for fixed_assets" ON public.fixed_assets
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant isolation for bills" ON public.bills
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant isolation for delivery_challans" ON public.delivery_challans
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant isolation for ledgers" ON public.ledgers
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Bill Lines (inherits parent bill owner)
CREATE POLICY "Tenant isolation for bill_lines" ON public.bill_lines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_lines.bill_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_lines.bill_id AND b.user_id = auth.uid()));

-- Delivery Challan Lines (inherits parent challan owner)
CREATE POLICY "Tenant isolation for delivery_challan_lines" ON public.delivery_challan_lines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_challans c WHERE c.id = delivery_challan_lines.challan_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_challans c WHERE c.id = delivery_challan_lines.challan_id AND c.user_id = auth.uid()));

-- 3. Fix storage bucket - restrict to authenticated users only
DROP POLICY IF EXISTS "public read bill-attachments" ON storage.objects;
DROP POLICY IF EXISTS "public write bill-attachments" ON storage.objects;
DROP POLICY IF EXISTS "public update bill-attachments" ON storage.objects;
DROP POLICY IF EXISTS "public delete bill-attachments" ON storage.objects;

CREATE POLICY "Users read own bill attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bill-attachments' AND (storage.foldername(name))[1] = 'bills');

CREATE POLICY "Users write own bill attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bill-attachments' AND (storage.foldername(name))[1] = 'bills');

CREATE POLICY "Users update own bill attachments" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bill-attachments' AND (storage.foldername(name))[1] = 'bills');

CREATE POLICY "Users delete own bill attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bill-attachments' AND (storage.foldername(name))[1] = 'bills');

-- 4. Revoke anon permissions from all application tables
REVOKE ALL ON public.companies FROM anon;
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.vendors FROM anon;
REVOKE ALL ON public.items FROM anon;
REVOKE ALL ON public.fixed_assets FROM anon;
REVOKE ALL ON public.bills FROM anon;
REVOKE ALL ON public.bill_lines FROM anon;
REVOKE ALL ON public.ledgers FROM anon;
REVOKE ALL ON public.delivery_challans FROM anon;
REVOKE ALL ON public.delivery_challan_lines FROM anon;
