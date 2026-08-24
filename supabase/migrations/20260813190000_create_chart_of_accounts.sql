-- Create chart_of_accounts table
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  classification TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  name TEXT NOT NULL,
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('Debit', 'Credit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_account_code UNIQUE (company_id, account_code)
);

-- Grant permissions for chart_of_accounts
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO anon, authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Create policy for full authenticated tenant access
CREATE POLICY "Tenant isolation for chart_of_accounts" ON public.chart_of_accounts
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Create trigger for setting updated_at on chart_of_accounts table
CREATE TRIGGER trg_chart_of_accounts_updated
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seeding function for Chart of Accounts
CREATE OR REPLACE FUNCTION public.seed_company_chart_of_accounts(comp_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.chart_of_accounts (company_id, account_code, classification, type, category, sub_category, name, normal_balance)
  VALUES
    (comp_id, '1000', 'Assets', 'Current Assets', 'Current Tax Assets', 'Current Tax Assets', 'ATR', 'Debit'),
    (comp_id, '1010', 'Assets', 'Current Assets', 'Current Tax Assets', 'Current Tax Assets', 'Advance Income tax', 'Debit'),
    (comp_id, '1020', 'Assets', 'Current Assets', 'Current Tax Assets', 'Current Tax Assets', 'ETDS', 'Debit'),
    (comp_id, '1030', 'Assets', 'Current Assets', 'Financial Assets', 'Cash & Cash Equivalents', 'Cash & Cash Equivalents', 'Debit'),
    (comp_id, '1040', 'Assets', 'Current Assets', 'Financial Assets', 'Other Financial Assets', 'Bank Margins', 'Debit'),
    (comp_id, '1050', 'Assets', 'Current Assets', 'Financial Assets', 'Other Financial Assets', 'Loans & Advances', 'Debit'),
    (comp_id, '1060', 'Assets', 'Current Assets', 'Financial Assets', 'Other Financial Assets', 'Securities & Deposits (Asset)', 'Debit'),
    (comp_id, '1070', 'Assets', 'Current Assets', 'Financial Assets', 'Trade Receivables', 'Trade Receivables', 'Debit'),
    (comp_id, '1080', 'Assets', 'Current Assets', 'Inventories', 'Inventories', 'Inventories', 'Debit'),
    (comp_id, '1090', 'Assets', 'Current Assets', 'Other Current Assets', 'Other Current Assets', 'Prepaid Expenses', 'Debit'),
    (comp_id, '1100', 'Assets', 'Current Assets', 'Other Current Assets', 'Other Current Assets', 'Staff Advances', 'Debit'),
    (comp_id, '1110', 'Assets', 'Current Assets', 'Other Current Assets', 'Other Current Assets', 'Suspense', 'Debit'),
    (comp_id, '1120', 'Assets', 'Non-Current Assets', 'Deferred Tax Assets', 'Deferred Tax Assets', 'Deferred Tax Assets', 'Debit'),
    (comp_id, '1130', 'Assets', 'Non-Current Assets', 'Intangible assets', 'Intangible assets', 'Software', 'Debit'),
    (comp_id, '1140', 'Assets', 'Non-Current Assets', 'Intangible assets', 'Intangible assets', 'Website', 'Debit'),
    (comp_id, '1150', 'Assets', 'Non-Current Assets', 'Property, Plant and Equipment', 'Property, Plant and Equipment', 'Building', 'Debit'),
    (comp_id, '1160', 'Assets', 'Non-Current Assets', 'Property, Plant and Equipment', 'Property, Plant and Equipment', 'Computer & Peripherals', 'Debit'),
    (comp_id, '1170', 'Assets', 'Non-Current Assets', 'Property, Plant and Equipment', 'Property, Plant and Equipment', 'Furniture & Fixtures', 'Debit'),
    (comp_id, '1180', 'Assets', 'Non-Current Assets', 'Property, Plant and Equipment', 'Property, Plant and Equipment', 'Land', 'Debit'),
    (comp_id, '1190', 'Assets', 'Non-Current Assets', 'Property, Plant and Equipment', 'Property, Plant and Equipment', 'Office Equipments', 'Debit'),
    (comp_id, '1200', 'Assets', 'Non-Current Assets', 'Property, Plant and Equipment', 'Property, Plant and Equipment', 'Other Assets', 'Debit'),
    (comp_id, '1210', 'Assets', 'Non-Current Assets', 'Property, Plant and Equipment', 'Property, Plant and Equipment', 'Vehicles', 'Debit'),
    (comp_id, '2000', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Short-term Borrowings', 'Adhoc Loan', 'Credit'),
    (comp_id, '2010', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Short-term Borrowings', 'Force Loan', 'Credit'),
    (comp_id, '2020', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Short-term Borrowings', 'Overdraft', 'Credit'),
    (comp_id, '2030', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Short-term Borrowings', 'Short-Term Loan', 'Credit'),
    (comp_id, '2040', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Short-term Borrowings', 'Trust-Receipt Loan', 'Credit'),
    (comp_id, '2050', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Short-term Borrowings', 'Unsecured Loans', 'Credit'),
    (comp_id, '2060', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Other Financial Liabilities', 'CIT Payable', 'Credit'),
    (comp_id, '2070', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Other Financial Liabilities', 'Rent Payable', 'Credit'),
    (comp_id, '2080', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Other Financial Liabilities', 'Salary Payable', 'Credit'),
    (comp_id, '2090', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Other Financial Liabilities', 'TDS Payable', 'Credit'),
    (comp_id, '2100', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Other Financial Liabilities', 'VAT Payable', 'Credit'),
    (comp_id, '2110', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Trade payables', 'Other Creditors', 'Credit'),
    (comp_id, '2120', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Trade payables', 'Trade payables', 'Credit'),
    (comp_id, '2130', 'Liabilities', 'Current Liabilities', 'Other current liabilities', 'Other current liabilities', 'Audit Fee Payable', 'Credit'),
    (comp_id, '2140', 'Liabilities', 'Current Liabilities', 'Other current liabilities', 'Other current liabilities', 'Bonus Payable', 'Credit'),
    (comp_id, '2150', 'Liabilities', 'Current Liabilities', 'Other current liabilities', 'Other current liabilities', 'Director Accounts', 'Credit'),
    (comp_id, '2160', 'Liabilities', 'Current Liabilities', 'Other current liabilities', 'Other current liabilities', 'Dividend Payable', 'Credit'),
    (comp_id, '2170', 'Liabilities', 'Current Liabilities', 'Other current liabilities', 'Other current liabilities', 'Other Payables', 'Credit'),
    (comp_id, '2180', 'Liabilities', 'Current Liabilities', 'Other current liabilities', 'Other current liabilities', 'Provision for Income Tax', 'Credit'),
    (comp_id, '2190', 'Liabilities', 'Current Liabilities', 'Other current liabilities', 'Other current liabilities', 'Staff Payables', 'Credit'),
    (comp_id, '2200', 'Liabilities', 'Non-Current Liabilities', 'Deferred tax liabilities', 'Deferred tax liabilities', 'Deferred tax liabilities', 'Credit'),
    (comp_id, '2210', 'Liabilities', 'Current Liabilities', 'Financial Liabilities', 'Short-term Borrowings', 'Cash Credit Loan', 'Credit'),
    (comp_id, '2220', 'Liabilities', 'Non-Current Liabilities', 'Financial Liabilities', 'Long-term borrowings', 'Fixed Term Loan', 'Credit'),
    (comp_id, '2230', 'Liabilities', 'Non-Current Liabilities', 'Financial Liabilities', 'Long-term borrowings', 'Hire Purchase Loan', 'Credit'),
    (comp_id, '2240', 'Liabilities', 'Non-Current Liabilities', 'Financial Liabilities', 'Long-term borrowings', 'Working Capital Loan', 'Credit'),
    (comp_id, '2250', 'Liabilities', 'Equity', 'Other Equity', 'Other Equity', 'Dividend', 'Credit'),
    (comp_id, '2260', 'Liabilities', 'Equity', 'Other Equity', 'Other Equity', 'Other Equity', 'Credit'),
    (comp_id, '2270', 'Liabilities', 'Equity', 'Share Capital', 'Share Capital', 'Share Capital', 'Credit'),
    (comp_id, '4000', 'PL', 'Revenue from Operations', 'Revenue from Operations', 'Sales', 'Trading Sales', 'Credit'),
    (comp_id, '4010', 'PL', 'Other Income', 'Other Income', 'Other Income', 'Other Income', 'Credit'),
    (comp_id, '4020', 'PL', 'Other Income', 'Other Income', 'Other Income', 'Rent Income', 'Credit'),
    (comp_id, '4030', 'PL', 'Other Income', 'Other Income', 'Other Income', 'Service Income', 'Credit'),
    (comp_id, '4040', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Audit Fees', 'Debit'),
    (comp_id, '4050', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Bank Charges', 'Debit'),
    (comp_id, '4060', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Bank Commission', 'Debit'),
    (comp_id, '4070', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Consulantancy Fee', 'Debit'),
    (comp_id, '4080', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Electricity Expenses', 'Debit'),
    (comp_id, '4090', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Employee Cost', 'Debit'),
    (comp_id, '4100', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Health and Amenities', 'Debit'),
    (comp_id, '4110', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'IT & Communication', 'Debit'),
    (comp_id, '4120', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Insurance', 'Debit'),
    (comp_id, '4130', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Legal Expenses', 'Debit'),
    (comp_id, '4140', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Local Tax, Renewal & Registration', 'Debit'),
    (comp_id, '4150', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Mess Expenses', 'Debit'),
    (comp_id, '4160', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Misc.Expenses', 'Debit'),
    (comp_id, '4170', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Office Expenses', 'Debit'),
    (comp_id, '4180', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Parking Expenses', 'Debit'),
    (comp_id, '4190', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Printing & Stationery', 'Debit'),
    (comp_id, '4200', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Renewal & Registration Expenses', 'Debit'),
    (comp_id, '4210', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Rent Expenses', 'Debit'),
    (comp_id, '4220', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Repair & Maintenance', 'Debit'),
    (comp_id, '4230', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Round Off', 'Debit'),
    (comp_id, '4240', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Staff Welfare', 'Debit'),
    (comp_id, '4250', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Subscriptions', 'Debit'),
    (comp_id, '4260', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Tax Expenses', 'Debit'),
    (comp_id, '4270', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Tour and Travelling', 'Debit'),
    (comp_id, '4280', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Training Expenses', 'Debit'),
    (comp_id, '4290', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Travelling Expenses', 'Debit'),
    (comp_id, '4300', 'PL', 'Operating Expenses', 'Cost of Sales', 'Cost of Sales', 'Direct Expenses', 'Debit'),
    (comp_id, '4310', 'PL', 'Operating Expenses', 'Cost of Sales', 'Cost of Sales', 'Purchase of Goods', 'Debit'),
    (comp_id, '4320', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Advertisement & Publicity', 'Debit'),
    (comp_id, '4330', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Business Promotion Expenses', 'Debit'),
    (comp_id, '4340', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Cargo & Couriers Expenses', 'Debit'),
    (comp_id, '4350', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Discount Allowed', 'Debit'),
    (comp_id, '4360', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Exhibition Expenses', 'Debit'),
    (comp_id, '4370', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Fuel Expenses', 'Debit'),
    (comp_id, '4380', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Installation Charge', 'Debit'),
    (comp_id, '4390', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Loading Unloading', 'Debit'),
    (comp_id, '4400', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Marketing Expenses', 'Debit'),
    (comp_id, '4410', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Sponsorship  Fee', 'Debit'),
    (comp_id, '4420', 'PL', 'Operating Expenses', 'Selling and Distribution Expenses', 'Selling and Distribution Expenses', 'Tender Expenses', 'Debit'),
    (comp_id, '4430', 'PL', 'Depreciation and Amortization Expense', 'Depreciation and Amortization Expense', 'Depreciation and Amortization Expense', 'Depreciation and Amortization Expense', 'Debit'),
    (comp_id, '4440', 'PL', 'Finance Costs', 'Finance Costs', 'Finance Costs', 'Bank Interest', 'Debit'),
    (comp_id, '4450', 'PL', 'Finance Costs', 'Finance Costs', 'Finance Costs', 'Interest on Unsecured Loans', 'Debit'),
    (comp_id, '4460', 'PL', 'Finance Costs', 'Finance Costs', 'Finance Costs', 'Loan Processing & Renewal Expenses', 'Debit'),
    (comp_id, '4470', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Fine and Penalty', 'Debit'),
    (comp_id, '4480', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Forex (Gain)/Loss', 'Debit'),
    (comp_id, '4490', 'PL', 'Operating Expenses', 'Administrative Expenses', 'Administrative Expenses', 'Gift And Donation', 'Debit')
  ON CONFLICT (company_id, account_code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Trigger to seed chart of accounts on new company insertion
CREATE OR REPLACE FUNCTION public.trg_seed_new_company_coa()
RETURNS trigger AS $$
BEGIN
  PERFORM public.seed_company_chart_of_accounts(new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_companies_seed_coa
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_new_company_coa();

-- Seed for all existing companies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_company_chart_of_accounts(r.id);
  END LOOP;
END $$;
