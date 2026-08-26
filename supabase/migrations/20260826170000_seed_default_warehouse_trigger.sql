-- Migration to rename default warehouse to Warehouse-1 with Location: Ground floor
-- and add a trigger to seed it for new companies.

-- 1. Rename existing default warehouses if they match "Main Warehouse" and is_main = true
UPDATE warehouses 
SET name = 'Warehouse-1', location = 'Ground floor'
WHERE is_main = true AND name = 'Main Warehouse';

-- Also make sure there is at least one main warehouse named Warehouse-1 if none exist
DO $$
DECLARE
  comp RECORD;
  wh_id UUID;
BEGIN
  FOR comp IN SELECT id FROM companies LOOP
    -- Check if Warehouse-1 or Main Warehouse exists
    SELECT id INTO wh_id FROM warehouses WHERE company_id = comp.id AND (name = 'Warehouse-1' OR is_main = true);
    
    IF wh_id IS NULL THEN
      INSERT INTO warehouses (company_id, name, location, is_main) 
      VALUES (comp.id, 'Warehouse-1', 'Ground floor', true) 
      RETURNING id INTO wh_id;
    ELSE
      -- Ensure it has the correct properties
      UPDATE warehouses 
      SET name = 'Warehouse-1', location = 'Ground floor', is_main = true 
      WHERE id = wh_id;
    END IF;
  END LOOP;
END $$;

-- 2. Create trigger function to auto-create Warehouse-1 for new companies
CREATE OR REPLACE FUNCTION public.seed_company_default_warehouse()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.warehouses (company_id, name, location, is_main)
  VALUES (new.id, 'Warehouse-1', 'Ground floor', true)
  ON CONFLICT (company_id, name) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 3. Bind trigger to companies table
DROP TRIGGER IF EXISTS trg_companies_seed_warehouse ON public.companies;
CREATE TRIGGER trg_companies_seed_warehouse
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_company_default_warehouse();
