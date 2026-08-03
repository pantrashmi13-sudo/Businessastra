-- Multi-tenant Data Isolation Migration via Row-Level Security (RLS)
-- Each user only accesses their own data (user_id = auth.uid())

-- 1. Add user_id column to core master tables
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- 2. Drop legacy wide-open policies
DROP POLICY IF EXISTS "public all companies" ON public.companies;
DROP POLICY IF EXISTS "public all customers" ON public.customers;
DROP POLICY IF EXISTS "public all vendors" ON public.vendors;
DROP POLICY IF EXISTS "public all items" ON public.items;
DROP POLICY IF EXISTS "public all fixed_assets" ON public.fixed_assets;
DROP POLICY IF EXISTS "public all bills" ON public.bills;
DROP POLICY IF EXISTS "public all delivery_challans" ON public.delivery_challans;
DROP POLICY IF EXISTS "public all bill_lines" ON public.bill_lines;
DROP POLICY IF EXISTS "public all delivery_challan_lines" ON public.delivery_challan_lines;

-- 3. Create Tenant Isolation Policies (Strictly scoped to auth.uid())

-- Companies
CREATE POLICY "Tenant isolation for companies" ON public.companies
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Customers
CREATE POLICY "Tenant isolation for customers" ON public.customers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Vendors
CREATE POLICY "Tenant isolation for vendors" ON public.vendors
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Items
CREATE POLICY "Tenant isolation for items" ON public.items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Fixed Assets
CREATE POLICY "Tenant isolation for fixed_assets" ON public.fixed_assets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Bills
CREATE POLICY "Tenant isolation for bills" ON public.bills
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Delivery Challans
CREATE POLICY "Tenant isolation for delivery_challans" ON public.delivery_challans
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

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
