import { z } from "zod";
import type { FieldDef } from "./MasterForm";

const opt = z.string().trim().optional().or(z.literal("").transform(() => undefined));

export const companySchema = z.object({
  name: z.string().trim().min(1, "Name required").max(200),
  tax_type: z.enum(["vat", "pan"]).default("vat"),
  vat_number: opt,
  pan: opt,
  logo_url: opt,
  date_format: z.enum(["ad", "bs"]).default("ad"),
  fy_start_year: z.coerce.number().int().min(2000).max(2100).optional(),
  fy_start_date: opt,
  address: opt,
  state: opt,
  city: opt,
  pincode: opt,
  phone: opt,
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  is_default: z.boolean().optional(),
});

export const companyFields: FieldDef[] = [
  { key: "name", label: "Company Name", colSpan: 2 },
  { key: "tax_type", label: "Tax Type", type: "select", options: ["vat", "pan"] },
  { key: "vat_number", label: "VAT Number", placeholder: "Enter VAT number if applicable" },
  { key: "pan", label: "PAN Number", placeholder: "Enter PAN number if applicable" },
  { key: "date_format", label: "Date Format", type: "select", options: ["ad", "bs"], placeholder: "AD = Gregorian, BS = Bikram Sambat" },
  { key: "fy_start_date", label: "Financial Year Start Date", placeholder: "Pick from calendar" },
  { key: "logo_url", label: "Company Logo", type: "logo-upload", colSpan: 2 },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "pincode", label: "Pincode" },
  { key: "address", label: "Address", type: "textarea", colSpan: 2 },
  { key: "is_default", label: "Default company", type: "switch" },
];

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  vat_number: opt,
  contact_person: opt,
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: opt,
  state: opt,
  city: opt,
  pincode: opt,
  billing_address: opt,
});
export const customerFields: FieldDef[] = [
  { key: "name", label: "Customer Name", colSpan: 2 },
  { key: "vat_number", label: "VAT / PAN Number", type: "pan-search", placeholder: "Enter VAT or PAN number" },
  { key: "contact_person", label: "Contact Person" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "pincode", label: "Pincode" },
  { key: "billing_address", label: "Billing Address", type: "textarea", colSpan: 2 },
];

export const vendorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  vat_number: opt,
  pan: opt,
  contact_person: opt,
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: opt,
  state: opt,
  city: opt,
  pincode: opt,
  address: opt,
  payment_terms: opt,
});
export const vendorFields: FieldDef[] = [
  { key: "name", label: "Vendor Name", colSpan: 2 },
  { key: "vat_number", label: "VAT / PAN Number", type: "pan-search", placeholder: "Enter VAT or PAN number" },
  { key: "pan", label: "PAN" },
  { key: "contact_person", label: "Contact Person" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "pincode", label: "Pincode" },
  { key: "payment_terms", label: "Payment Terms", placeholder: "Net 30" },
  { key: "address", label: "Address", type: "textarea", colSpan: 2 },
];

export const itemSchema = z.object({
  item_code: z.string().trim().min(1, "Code required").max(50),
  item_name: z.string().trim().min(1, "Name required").max(200),
  uom: z.string().trim().min(1).default("NOS"),
  hsn_code: opt,
  default_rate: z.coerce.number().min(0).default(0),
  vat_rate: z.coerce.number().min(0).max(100).default(5),
  qty: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0).default(0),
  reorder_level: z.coerce.number().min(0).default(0),
  warehouse: opt,
  warehouse_id: opt,
  rag_number: opt,
  status: opt,
  category: opt,
  parent_category: opt,
  sub_parent_category: opt,
  sub_category: opt,
  alt_uom: opt,
  alt_uom_conversion: z.coerce.number().min(0).optional(),
  is_service: z.boolean().optional(),
  is_inventory: z.boolean().optional().default(true),
  description: opt,
  opening_qty: z.coerce.number().min(0).default(0),
  opening_rate: z.coerce.number().min(0).default(0),
  opening_value: z.coerce.number().min(0).default(0),
  sales_ledger: opt,
  purchase_ledger: opt,
  tds_applicable: z.boolean().optional().default(false),
  tds_rate: z.coerce.number().min(0).max(100).optional().default(0),
});

export const itemBasicFields: FieldDef[] = [
  { key: "item_code", label: "Item Code" },
  { key: "item_name", label: "Item Name" },
  { key: "uom", label: "Unit", placeholder: "Kg, Piece, Box, Liter…" },
  { key: "hsn_code", label: "HSN Code" },
  { key: "vat_rate", label: "VAT %", type: "number" },
  { key: "selling_price", label: "Selling Price", type: "number" },
  { key: "category", label: "Category", type: "category-group" as const },
  { key: "reorder_level", label: "Reorder Level", type: "number" },
  {
    key: "warehouse",
    label: "Warehouse",
    type: "select",
    options: ["Main Warehouse", "Store Room", "Office", "Site", "Other"],
    placeholder: "Select warehouse",
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Inactive"],
  },
  { key: "alt_uom", label: "Alt UOM", placeholder: "BOX, CASE, DOZEN…" },
  { key: "alt_uom_conversion", label: "1 Main = X Alt", type: "number", placeholder: "e.g., 12" },
  { key: "opening_stock", label: "Opening Stock", type: "opening-stock" },
];

export const itemConfigFields: FieldDef[] = [
  { key: "is_inventory", label: "Inventory Item", type: "switch" },
  { key: "reorder_level", label: "Reorder Level", type: "number" },
  { key: "default_rate", label: "Default Rate", type: "number" },
];

export const itemDescriptionFields: FieldDef[] = [
  { key: "description", label: "Description", type: "textarea", colSpan: 2 },
];

export const itemLedgerFields: FieldDef[] = [
  { key: "sales_ledger", label: "Sales Ledger", placeholder: "e.g., Sales Account" },
  { key: "purchase_ledger", label: "Purchase Ledger", placeholder: "e.g., Purchase Account" },
];

export const itemFields: FieldDef[] = [
  ...itemBasicFields,
  ...itemConfigFields,
  ...itemDescriptionFields,
  ...itemLedgerFields,
];

export const serviceSchema = z.object({
  item_code: z.string().trim().min(1, "Code required").max(50),
  item_name: z.string().trim().min(1, "Name required").max(200),
  uom: z.string().trim().min(1).default("NOS"),
  hsn_code: opt,
  default_rate: z.coerce.number().min(0).default(0),
  vat_rate: z.coerce.number().min(0).max(100).default(5),
  qty: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0).default(0),
  reorder_level: z.coerce.number().min(0).default(0),
  warehouse: opt,
  status: opt,
  category: opt,
  parent_category: opt,
  sub_parent_category: opt,
  sub_category: opt,
  alt_uom: opt,
  alt_uom_conversion: z.coerce.number().min(0).optional(),
  is_service: z.boolean().optional().default(true),
  is_inventory: z.boolean().optional().default(false),
  description: opt,
  opening_qty: z.coerce.number().min(0).default(0),
  opening_rate: z.coerce.number().min(0).default(0),
  opening_value: z.coerce.number().min(0).default(0),
  sales_ledger: opt,
  purchase_ledger: opt,
  tds_applicable: z.boolean().optional().default(false),
  tds_rate: z.coerce.number().min(0).max(100).optional().default(0),
});

export const serviceBasicFields: FieldDef[] = [
  { key: "item_code", label: "Service Code" },
  { key: "item_name", label: "Service Name" },
  { key: "uom", label: "Unit", placeholder: "NOS, HOUR, DAY…" },
  { key: "hsn_code", label: "SAC Code" },
  { key: "vat_rate", label: "VAT %", type: "number" },
  { key: "selling_price", label: "Selling Price", type: "number" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Inactive"],
  },
];

export const serviceDescriptionFields: FieldDef[] = [
  { key: "description", label: "Description", type: "textarea", colSpan: 2 },
];

export const serviceLedgerFields: FieldDef[] = [
  { key: "sales_ledger", label: "Sales Ledger", placeholder: "e.g., Service Income" },
];

export const serviceFields: FieldDef[] = [
  ...serviceBasicFields,
  ...serviceDescriptionFields,
  ...serviceLedgerFields,
];

export const fixedAssetSchema = z.object({
  asset_code: z.string().trim().min(1).max(50),
  asset_name: z.string().trim().min(1).max(200),
  category: opt,
  uom: z.string().trim().min(1).default("NOS"),
  hsn_code: opt,
  pan: opt,
  qty: z.coerce.number().int().min(0).default(0),
  purchase_date: opt,
  purchase_cost: z.coerce.number().min(0).default(0),
  total_cost: z.coerce.number().min(0).default(0),
  default_rate: z.coerce.number().min(0).default(0),
  vat_rate: z.coerce.number().min(0).max(100).default(5),
  depreciation_method: opt,
  useful_life: z.coerce.number().int().min(1).optional(),
  depreciation_rate: z.coerce.number().min(0).max(100).optional(),
  residual_value: z.coerce.number().min(0).default(0),
  is_opening: z.coerce.boolean().default(false),
  opening_qty: z.coerce.number().int().min(0).default(0),
  opening_wdv: z.coerce.number().min(0).default(0),
  status: opt,
  description: opt,
});
export const fixedAssetFields: FieldDef[] = [
  { key: "asset_code", label: "Asset Code" },
  { key: "asset_name", label: "Asset Name" },
  {
    key: "category",
    label: "Category",
    type: "select",
    options: ["Furniture", "Vehicle", "Computer", "Machinery", "Building", "Land", "Other"],
    placeholder: "Select category",
  },
  { key: "uom", label: "Unit" },
  { key: "purchase_date", label: "Purchase Date", placeholder: "YYYY-MM-DD" },
  {
    key: "depreciation_method",
    label: "Depreciation Method",
    type: "select",
    options: ["Straight Line", "Declining Balance"],
    placeholder: "Select method",
  },
  { key: "useful_life", label: "Useful Life (Years)", type: "number" },
  { key: "depreciation_rate", label: "OR Depreciation Rate (%)", type: "number" },
  { key: "residual_value", label: "Residual Value", type: "number" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Disposed"],
  },
  { key: "description", label: "Description", type: "textarea", colSpan: 2 },
  { key: "is_opening", label: "Opening Asset", type: "switch" },
  { key: "opening_qty", label: "Opening Quantity", type: "number" },
  { key: "opening_wdv", label: "Opening WDV", type: "number" },
];
