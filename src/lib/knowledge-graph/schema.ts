// Knowledge Graph Schema — all entities, relationships, and metadata
// for the Bizastra ERP data model

export type EntityType =
  | "core"
  | "master"
  | "transaction"
  | "financial"
  | "inventory"
  | "accounting";

export interface GraphNode {
  id: string;
  label: string;
  entity: string; // DB table name
  type: EntityType;
  description: string;
  columns: string[];
  /** Relationships originating FROM this node */
  outgoing: GraphEdge[];
  /** Relationships pointing TO this node */
  incoming: GraphEdge[];
  /** Computed layout position */
  x: number;
  y: number;
  /** Velocity for force simulation */
  vx: number;
  vy: number;
}

export interface GraphEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  label: string; // column name
  relation: "one-to-many" | "many-to-one" | "polymorphic" | "logical";
  onDelete?: string;
}

/** Groups for visual clustering */
export interface GraphCluster {
  id: string;
  label: string;
  type: EntityType;
  color: string;
  nodeIds: string[];
}

// ── All nodes ────────────────────────────────────────────────────────────────
const NODES: Omit<GraphNode, "outgoing" | "incoming" | "x" | "y" | "vx" | "vy">[] = [
  // Core
  {
    id: "companies",
    label: "Companies",
    entity: "companies",
    type: "core",
    description: "Tenant organizations. Every record is scoped to a company.",
    columns: [
      "id",
      "name",
      "vat_number",
      "pan",
      "address",
      "state",
      "city",
      "user_id",
      "logo_url",
      "tax_type",
      "date_format",
      "fy_start_year",
      "fy_start_date",
      "fy_end_date",
    ],
  },
  {
    id: "users",
    label: "Users",
    entity: "auth.users",
    type: "core",
    description: "Supabase auth users. All tables have user_id for tenant isolation.",
    columns: ["id", "email", "created_at"],
  },

  // Masters
  {
    id: "customers",
    label: "Customers",
    entity: "customers",
    type: "master",
    description: "Customer master — billing, shipping, contact info, payment terms.",
    columns: [
      "id",
      "name",
      "vat_number",
      "contact_person",
      "email",
      "phone",
      "billing_address",
      "state",
      "city",
      "pincode",
      "payment_terms_days",
      "user_id",
    ],
  },
  {
    id: "vendors",
    label: "Vendors",
    entity: "vendors",
    type: "master",
    description: "Supplier / vendor master — purchasing, PAN, payment terms.",
    columns: [
      "id",
      "name",
      "vat_number",
      "pan",
      "contact_person",
      "email",
      "phone",
      "address",
      "state",
      "city",
      "pincode",
      "payment_terms",
      "user_id",
    ],
  },
  {
    id: "items",
    label: "Items",
    entity: "items",
    type: "master",
    description: "Inventory items — stock tracking, pricing, 4-level category hierarchy.",
    columns: [
      "id",
      "item_code",
      "item_name",
      "uom",
      "hsn_code",
      "default_rate",
      "vat_rate",
      "is_service",
      "qty",
      "selling_price",
      "reorder_level",
      "warehouse",
      "warehouse_id",
      "category",
      "parent_category",
      "sub_parent_category",
      "sub_category",
      "opening_qty",
      "opening_rate",
      "opening_value",
      "is_inventory",
      "status",
      "user_id",
    ],
  },
  {
    id: "fixed_assets",
    label: "Fixed Assets",
    entity: "fixed_assets",
    type: "master",
    description: "Fixed assets register — depreciation, book value, useful life.",
    columns: [
      "id",
      "asset_code",
      "asset_name",
      "category",
      "uom",
      "hsn_code",
      "default_rate",
      "vat_rate",
      "depreciation_rate",
      "qty",
      "purchase_date",
      "purchase_cost",
      "total_cost",
      "accumulated_depreciation",
      "book_value",
      "status",
      "user_id",
    ],
  },
  {
    id: "warehouses",
    label: "Warehouses",
    entity: "warehouses",
    type: "master",
    description: "Storage locations with rack/aisle/grid (RAG) system.",
    columns: ["id", "company_id", "name", "location", "incharge_person"],
  },
  {
    id: "warehouse_rags",
    label: "RAG Locations",
    entity: "warehouse_rags",
    type: "master",
    description: "Rack / Aisle / Grid positions within a warehouse.",
    columns: ["id", "warehouse_id", "name", "code", "description", "capacity"],
  },

  // Transactions — Purchase side
  {
    id: "bills",
    label: "Purchase Bills",
    entity: "bills",
    type: "transaction",
    description: "Purchase invoices from vendors — items, services, or fixed assets.",
    columns: [
      "id",
      "bill_type",
      "vendor_id",
      "company_id",
      "bill_number",
      "invoice_date",
      "po_number",
      "taxable_amount",
      "vat_amount",
      "final_amount",
      "status",
      "user_id",
    ],
  },
  {
    id: "bill_lines",
    label: "Bill Lines",
    entity: "bill_lines",
    type: "transaction",
    description: "Line items on a purchase bill — quantity, rate, lot tracking.",
    columns: [
      "id",
      "bill_id",
      "sno",
      "ref_type",
      "ref_id",
      "code",
      "name",
      "uom",
      "quantity",
      "per_unit",
      "vat_rate",
      "lot_number",
      "line_amount",
      "landing_cost",
      "warehouse_id",
    ],
  },
  {
    id: "purchase_returns",
    label: "Purchase Returns",
    entity: "purchase_returns",
    type: "transaction",
    description: "Debit notes / return to vendor against original bill.",
    columns: [
      "id",
      "return_number",
      "return_date",
      "original_bill_id",
      "vendor_id",
      "company_id",
      "taxable_amount",
      "vat_amount",
      "total_amount",
      "status",
      "user_id",
    ],
  },
  {
    id: "purchase_return_lines",
    label: "Purchase Return Lines",
    entity: "purchase_return_lines",
    type: "transaction",
    description: "Line items on a purchase return.",
    columns: [
      "id",
      "return_id",
      "sno",
      "ref_id",
      "code",
      "name",
      "quantity",
      "per_unit",
      "vat_rate",
      "line_amount",
      "warehouse_id",
    ],
  },

  // Transactions — Sales side
  {
    id: "delivery_challans",
    label: "Delivery Challans",
    entity: "delivery_challans",
    type: "transaction",
    description: "Goods dispatch notes — tracks delivery to customers.",
    columns: [
      "id",
      "customer_id",
      "company_id",
      "challan_number",
      "challan_date",
      "po_reference",
      "delivery_address",
      "vehicle_number",
      "total_amount",
      "status",
      "warehouse_id",
      "user_id",
    ],
  },
  {
    id: "challan_lines",
    label: "Challan Lines",
    entity: "delivery_challan_lines",
    type: "transaction",
    description: "Line items on a delivery challan.",
    columns: [
      "id",
      "challan_id",
      "sno",
      "ref_id",
      "code",
      "name",
      "uom",
      "quantity",
      "per_unit",
      "line_amount",
      "warehouse_id",
    ],
  },
  {
    id: "sales_invoices",
    label: "Sales Invoices",
    entity: "sales_invoices",
    type: "transaction",
    description: "Tax invoices to customers — linked to challans.",
    columns: [
      "id",
      "invoice_number",
      "invoice_date",
      "invoice_type",
      "company_id",
      "customer_id",
      "challan_ids",
      "subtotal",
      "discount",
      "vat_amount",
      "total_amount",
      "status",
      "user_id",
    ],
  },
  {
    id: "sales_invoice_lines",
    label: "Sales Invoice Lines",
    entity: "sales_invoice_lines",
    type: "transaction",
    description: "Line items on a sales invoice.",
    columns: [
      "id",
      "invoice_id",
      "sno",
      "ref_id",
      "code",
      "name",
      "uom",
      "quantity",
      "per_unit",
      "vat_rate",
      "line_amount",
      "warehouse_id",
    ],
  },
  {
    id: "sales_returns",
    label: "Sales Returns",
    entity: "sales_returns",
    type: "transaction",
    description: "Credit notes / customer returns against original invoice.",
    columns: [
      "id",
      "return_number",
      "return_date",
      "original_invoice_id",
      "customer_id",
      "company_id",
      "subtotal",
      "discount",
      "vat_amount",
      "total_amount",
      "status",
      "user_id",
    ],
  },
  {
    id: "sales_return_lines",
    label: "Sales Return Lines",
    entity: "sales_return_lines",
    type: "transaction",
    description: "Line items on a sales return.",
    columns: [
      "id",
      "return_id",
      "sno",
      "ref_id",
      "code",
      "name",
      "quantity",
      "per_unit",
      "vat_rate",
      "line_amount",
      "warehouse_id",
    ],
  },
  {
    id: "consumptions",
    label: "Consumptions",
    entity: "consumptions",
    type: "transaction",
    description: "Internal consumption of inventory items.",
    columns: ["id", "consumption_number", "consumption_date", "notes", "company_id", "status"],
  },
  {
    id: "consumption_lines",
    label: "Consumption Lines",
    entity: "consumption_lines",
    type: "transaction",
    description: "Line items on a consumption entry.",
    columns: [
      "id",
      "consumption_id",
      "sno",
      "ref_id",
      "code",
      "name",
      "uom",
      "quantity",
      "per_unit",
      "line_amount",
    ],
  },

  // Financial
  {
    id: "payment_vouchers",
    label: "Payment Vouchers",
    entity: "payment_vouchers",
    type: "financial",
    description: "Payments made to vendors — bill-wise or simple adjustment.",
    columns: [
      "id",
      "company_id",
      "voucher_number",
      "payee_type",
      "vendor_id",
      "payment_mode",
      "reference_number",
      "payment_date",
      "total_amount",
      "adjustment_type",
      "status",
      "user_id",
    ],
  },
  {
    id: "payment_voucher_bills",
    label: "Payment–Bill Links",
    entity: "payment_voucher_bills",
    type: "financial",
    description: "Many-to-many: which bills a payment voucher settles.",
    columns: ["id", "payment_voucher_id", "bill_id", "amount_applied"],
  },
  {
    id: "receipt_vouchers",
    label: "Receipt Vouchers",
    entity: "receipt_vouchers",
    type: "financial",
    description: "Receipts from customers — invoice-wise or simple adjustment.",
    columns: [
      "id",
      "company_id",
      "voucher_number",
      "payer_type",
      "customer_id",
      "receipt_mode",
      "reference_number",
      "receipt_date",
      "total_amount",
      "adjustment_type",
      "status",
      "user_id",
    ],
  },
  {
    id: "receipt_voucher_invoices",
    label: "Receipt–Invoice Links",
    entity: "receipt_voucher_invoices",
    type: "financial",
    description: "Many-to-many: which invoices a receipt voucher settles.",
    columns: ["id", "receipt_voucher_id", "invoice_id", "amount_applied"],
  },

  // Cash & Bank
  {
    id: "petty_cash_accounts",
    label: "Petty Cash",
    entity: "petty_cash_accounts",
    type: "financial",
    description: "Petty cash floats — cash-in-hand tracking.",
    columns: [
      "id",
      "company_id",
      "name",
      "description",
      "opening_balance",
      "current_balance",
      "status",
    ],
  },
  {
    id: "petty_cash_ledger",
    label: "Petty Cash Ledger",
    entity: "petty_cash_ledger",
    type: "financial",
    description: "Debit/credit entries against petty cash accounts.",
    columns: [
      "id",
      "petty_cash_id",
      "date",
      "description",
      "debit",
      "credit",
      "reference_type",
      "reference_id",
      "reconciled",
    ],
  },
  {
    id: "bank_accounts",
    label: "Bank Accounts",
    entity: "bank_accounts",
    type: "financial",
    description: "Company bank accounts — balance tracking.",
    columns: [
      "id",
      "company_id",
      "bank_name",
      "account_number",
      "account_holder_name",
      "branch",
      "opening_balance",
      "current_balance",
      "status",
    ],
  },
  {
    id: "bank_ledger",
    label: "Bank Ledger",
    entity: "bank_ledger",
    type: "financial",
    description: "Debit/credit entries against bank accounts.",
    columns: [
      "id",
      "bank_account_id",
      "date",
      "description",
      "debit",
      "credit",
      "reference_type",
      "reference_id",
      "reconciled",
    ],
  },
  {
    id: "loans",
    label: "Loans",
    entity: "loans",
    type: "financial",
    description: "Loan tracking — EMI, outstanding, interest.",
    columns: [
      "id",
      "company_id",
      "loan_type",
      "loan_name",
      "principal_amount",
      "interest_rate",
      "loan_outstanding",
      "lender_name",
      "emi_amount",
      "tenure_months",
      "status",
    ],
  },
  {
    id: "loan_ledger",
    label: "Loan Ledger",
    entity: "loan_ledger",
    type: "financial",
    description: "Repayment entries against loans.",
    columns: [
      "id",
      "loan_id",
      "date",
      "description",
      "debit",
      "credit",
      "interest_amount",
      "principal_amount",
      "reference_type",
      "reference_id",
      "reconciled",
    ],
  },

  // Accounting
  {
    id: "chart_of_accounts",
    label: "Chart of Accounts",
    entity: "chart_of_accounts",
    type: "accounting",
    description: "COA template — classification, type, normal balance.",
    columns: [
      "id",
      "company_id",
      "account_code",
      "classification",
      "type",
      "category",
      "sub_category",
      "name",
      "normal_balance",
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    entity: "accounts",
    type: "accounting",
    description: "Instance of a COA entry for a company — used in journal lines.",
    columns: ["id", "company_id", "coa_id", "name", "code", "description", "is_active"],
  },
  {
    id: "journal_entries",
    label: "Journal Entries",
    entity: "journal_entries",
    type: "accounting",
    description: "Double-entry journal — auto-posted from bills, invoices, vouchers.",
    columns: [
      "id",
      "company_id",
      "date",
      "voucher_number",
      "narration",
      "source_type",
      "source_id",
      "user_id",
    ],
  },
  {
    id: "journal_lines",
    label: "Journal Lines",
    entity: "journal_lines",
    type: "accounting",
    description: "Debit/credit legs of a journal entry.",
    columns: ["id", "journal_entry_id", "account_id", "debit", "credit", "narration"],
  },
  {
    id: "ledgers",
    label: "Vendor Ledgers",
    entity: "ledgers",
    type: "accounting",
    description: "Vendor-wise debit/credit ledger (legacy, superseded by journal).",
    columns: ["id", "vendor_id", "bill_id", "date", "description", "debit", "credit", "user_id"],
  },

  // Inventory
  {
    id: "stock_ledger",
    label: "Stock Ledger",
    entity: "stock_ledger",
    type: "inventory",
    description: "Inward/outward stock movements — running qty & value.",
    columns: [
      "id",
      "item_id",
      "movement_type",
      "doc_type",
      "doc_id",
      "doc_number",
      "party_name",
      "lot_number",
      "quantity",
      "uom",
      "unit_rate",
      "landing_unit_cost",
      "line_amount",
      "running_qty",
      "running_amount",
      "company_id",
      "warehouse_id",
    ],
  },
  {
    id: "stock_transfers",
    label: "Stock Transfers",
    entity: "stock_transfers",
    type: "inventory",
    description: "Inter-warehouse stock transfers.",
    columns: [
      "id",
      "transfer_number",
      "from_warehouse_id",
      "to_warehouse_id",
      "transfer_date",
      "status",
      "notes",
      "company_id",
    ],
  },
  {
    id: "stock_transfer_lines",
    label: "Transfer Lines",
    entity: "stock_transfer_lines",
    type: "inventory",
    description: "Line items on a stock transfer.",
    columns: ["id", "transfer_id", "item_id", "quantity", "from_rag_id", "to_rag_id"],
  },
];

// ── All edges (relationships) ────────────────────────────────────────────────
const EDGES: Omit<GraphEdge, "id">[] = [
  // Tenant isolation — every table → users
  {
    source: "companies",
    target: "users",
    label: "user_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "customers",
    target: "users",
    label: "user_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "vendors",
    target: "users",
    label: "user_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "items",
    target: "users",
    label: "user_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "fixed_assets",
    target: "users",
    label: "user_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },

  // Master → Company
  {
    source: "warehouses",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "chart_of_accounts",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "accounts",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "accounts",
    target: "chart_of_accounts",
    label: "coa_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "petty_cash_accounts",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "bank_accounts",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "loans",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "warehouse_rags",
    target: "warehouses",
    label: "warehouse_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "items",
    target: "warehouses",
    label: "warehouse_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "items",
    target: "warehouse_rags",
    label: "rag_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },

  // Purchase flow
  {
    source: "bills",
    target: "vendors",
    label: "vendor_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "bills",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "bill_lines",
    target: "bills",
    label: "bill_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "bill_lines",
    target: "items",
    label: "ref_id",
    relation: "polymorphic",
    onDelete: "SET NULL",
  },
  {
    source: "bill_lines",
    target: "warehouses",
    label: "warehouse_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "purchase_returns",
    target: "bills",
    label: "original_bill_id",
    relation: "many-to-one",
    onDelete: "RESTRICT",
  },
  {
    source: "purchase_returns",
    target: "vendors",
    label: "vendor_id",
    relation: "many-to-one",
    onDelete: "RESTRICT",
  },
  {
    source: "purchase_returns",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "purchase_return_lines",
    target: "purchase_returns",
    label: "return_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "purchase_return_lines",
    target: "items",
    label: "ref_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "purchase_return_lines",
    target: "warehouses",
    label: "warehouse_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },

  // Sales flow
  {
    source: "delivery_challans",
    target: "customers",
    label: "customer_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "delivery_challans",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "delivery_challans",
    target: "warehouses",
    label: "warehouse_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "challan_lines",
    target: "delivery_challans",
    label: "challan_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "challan_lines",
    target: "items",
    label: "ref_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "challan_lines",
    target: "warehouses",
    label: "warehouse_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "sales_invoices",
    target: "customers",
    label: "customer_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "sales_invoices",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "sales_invoice_lines",
    target: "sales_invoices",
    label: "invoice_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "sales_invoice_lines",
    target: "items",
    label: "ref_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "sales_invoice_lines",
    target: "warehouses",
    label: "warehouse_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "sales_returns",
    target: "sales_invoices",
    label: "original_invoice_id",
    relation: "many-to-one",
    onDelete: "RESTRICT",
  },
  {
    source: "sales_returns",
    target: "customers",
    label: "customer_id",
    relation: "many-to-one",
    onDelete: "RESTRICT",
  },
  {
    source: "sales_returns",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "sales_return_lines",
    target: "sales_returns",
    label: "return_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "sales_return_lines",
    target: "items",
    label: "ref_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "sales_return_lines",
    target: "warehouses",
    label: "warehouse_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },

  // Consumption
  {
    source: "consumptions",
    target: "companies",
    label: "company_id",
    relation: "logical",
    onDelete: "SET NULL",
  },
  {
    source: "consumption_lines",
    target: "consumptions",
    label: "consumption_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "consumption_lines",
    target: "items",
    label: "ref_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },

  // Financial
  {
    source: "payment_vouchers",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "payment_vouchers",
    target: "vendors",
    label: "vendor_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "payment_voucher_bills",
    target: "payment_vouchers",
    label: "payment_voucher_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "payment_voucher_bills",
    target: "bills",
    label: "bill_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "receipt_vouchers",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "receipt_vouchers",
    target: "customers",
    label: "customer_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "receipt_voucher_invoices",
    target: "receipt_vouchers",
    label: "receipt_voucher_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "receipt_voucher_invoices",
    target: "sales_invoices",
    label: "invoice_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },

  // Cash & Bank
  {
    source: "petty_cash_ledger",
    target: "petty_cash_accounts",
    label: "petty_cash_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "bank_ledger",
    target: "bank_accounts",
    label: "bank_account_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "loan_ledger",
    target: "loans",
    label: "loan_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },

  // Accounting
  {
    source: "journal_entries",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "journal_entries",
    target: "accounts",
    label: "source_id",
    relation: "polymorphic",
    onDelete: "SET NULL",
  },
  {
    source: "journal_lines",
    target: "journal_entries",
    label: "journal_entry_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "journal_lines",
    target: "accounts",
    label: "account_id",
    relation: "many-to-one",
    onDelete: "RESTRICT",
  },
  {
    source: "ledgers",
    target: "vendors",
    label: "vendor_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "ledgers",
    target: "bills",
    label: "bill_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },

  // Inventory
  {
    source: "stock_ledger",
    target: "items",
    label: "item_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "stock_ledger",
    target: "warehouses",
    label: "warehouse_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "stock_transfers",
    target: "warehouses",
    label: "from_warehouse_id",
    relation: "many-to-one",
    onDelete: "RESTRICT",
  },
  {
    source: "stock_transfers",
    target: "warehouses",
    label: "to_warehouse_id",
    relation: "many-to-one",
    onDelete: "RESTRICT",
  },
  {
    source: "stock_transfers",
    target: "companies",
    label: "company_id",
    relation: "many-to-one",
    onDelete: "CASCADE",
  },
  {
    source: "stock_transfer_lines",
    target: "stock_transfers",
    label: "transfer_id",
    relation: "one-to-many",
    onDelete: "CASCADE",
  },
  {
    source: "stock_transfer_lines",
    target: "items",
    label: "item_id",
    relation: "many-to-one",
    onDelete: "RESTRICT",
  },
  {
    source: "stock_transfer_lines",
    target: "warehouse_rags",
    label: "from_rag_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },
  {
    source: "stock_transfer_lines",
    target: "warehouse_rags",
    label: "to_rag_id",
    relation: "many-to-one",
    onDelete: "SET NULL",
  },

  // Challan → Invoice link (logical, via challan_ids array)
  {
    source: "sales_invoices",
    target: "delivery_challans",
    label: "challan_ids",
    relation: "logical",
  },
];

// ── Cluster definitions ──────────────────────────────────────────────────────
export const CLUSTERS: GraphCluster[] = [
  {
    id: "core",
    label: "Core / Auth",
    type: "core",
    color: "#6366f1",
    nodeIds: ["companies", "users"],
  },
  {
    id: "masters",
    label: "Master Data",
    type: "master",
    color: "#10b981",
    nodeIds: ["customers", "vendors", "items", "fixed_assets", "warehouses", "warehouse_rags"],
  },
  {
    id: "purchase",
    label: "Purchase Cycle",
    type: "transaction",
    color: "#f59e0b",
    nodeIds: ["bills", "bill_lines", "purchase_returns", "purchase_return_lines"],
  },
  {
    id: "sales",
    label: "Sales Cycle",
    type: "transaction",
    color: "#3b82f6",
    nodeIds: [
      "delivery_challans",
      "challan_lines",
      "sales_invoices",
      "sales_invoice_lines",
      "sales_returns",
      "sales_return_lines",
    ],
  },
  {
    id: "consumption",
    label: "Consumption",
    type: "transaction",
    color: "#ef4444",
    nodeIds: ["consumptions", "consumption_lines"],
  },
  {
    id: "financial",
    label: "Receipt & Payment",
    type: "financial",
    color: "#8b5cf6",
    nodeIds: [
      "payment_vouchers",
      "payment_voucher_bills",
      "receipt_vouchers",
      "receipt_voucher_invoices",
    ],
  },
  {
    id: "cashbank",
    label: "Cash & Bank",
    type: "financial",
    color: "#06b6d4",
    nodeIds: [
      "petty_cash_accounts",
      "petty_cash_ledger",
      "bank_accounts",
      "bank_ledger",
      "loans",
      "loan_ledger",
    ],
  },
  {
    id: "accounting",
    label: "Double-Entry",
    type: "accounting",
    color: "#f97316",
    nodeIds: ["chart_of_accounts", "accounts", "journal_entries", "journal_lines", "ledgers"],
  },
  {
    id: "inventory",
    label: "Inventory",
    type: "inventory",
    color: "#14b8a6",
    nodeIds: ["stock_ledger", "stock_transfers", "stock_transfer_lines"],
  },
];

// ── Build the graph ──────────────────────────────────────────────────────────
let edgeCounter = 0;

function buildGraph() {
  const nodeMap = new Map<string, GraphNode>();

  // Create nodes
  for (const n of NODES) {
    nodeMap.set(n.id, {
      ...n,
      outgoing: [],
      incoming: [],
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    });
  }

  // Create edges
  for (const e of EDGES) {
    const source = nodeMap.get(e.source);
    const target = nodeMap.get(e.target);
    if (!source || !target) continue;

    const edge: GraphEdge = {
      id: `e${++edgeCounter}`,
      ...e,
    };

    source.outgoing.push(edge);
    target.incoming.push(edge);
  }

  return nodeMap;
}

export const graphNodes = buildGraph();
export const graphEdges = EDGES.map((e, i) => ({ id: `e${i + 1}`, ...e }));

/** Get all nodes as an array */
export function getAllNodes(): GraphNode[] {
  return Array.from(graphNodes.values());
}

/** Get a single node by id */
export function getNode(id: string): GraphNode | undefined {
  return graphNodes.get(id);
}

/** Get all edges */
export function getAllEdges(): GraphEdge[] {
  return graphEdges;
}

/** Get the cluster a node belongs to */
export function getClusterForNode(nodeId: string): GraphCluster | undefined {
  return CLUSTERS.find((c) => c.nodeIds.includes(nodeId));
}

/** Get nodes that are directly connected (1-hop) to a given node */
export function getConnectedNodes(nodeId: string): GraphNode[] {
  const node = graphNodes.get(nodeId);
  if (!node) return [];

  const connectedIds = new Set<string>();
  for (const e of node.outgoing) connectedIds.add(e.target);
  for (const e of node.incoming) connectedIds.add(e.source);

  return Array.from(connectedIds)
    .map((id) => graphNodes.get(id))
    .filter(Boolean) as GraphNode[];
}

/** Get the shortest path between two nodes (BFS) */
export function getShortestPath(fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId];

  const visited = new Set<string>();
  const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];
  visited.add(fromId);

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    const node = graphNodes.get(id);
    if (!node) continue;

    for (const e of [...node.outgoing, ...node.incoming]) {
      const nextId = e.source === id ? e.target : e.source;
      if (nextId === toId) return [...path, nextId];
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push({ id: nextId, path: [...path, nextId] });
      }
    }
  }

  return null;
}

/** Get summary stats */
export function getGraphStats() {
  return {
    totalNodes: NODES.length,
    totalEdges: EDGES.length,
    clusters: CLUSTERS.length,
    byType: {
      core: NODES.filter((n) => n.type === "core").length,
      master: NODES.filter((n) => n.type === "master").length,
      transaction: NODES.filter((n) => n.type === "transaction").length,
      financial: NODES.filter((n) => n.type === "financial").length,
      inventory: NODES.filter((n) => n.type === "inventory").length,
      accounting: NODES.filter((n) => n.type === "accounting").length,
    },
  };
}
