# Ledgerly — Mini ERP

A modern, AI-powered Mini ERP system for managing bills, vendors, inventory, and fixed assets with OCR-based bill capture.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
  - [Running the OCR Service](#running-the-ocr-service)
- [Project Structure](#project-structure)
- [Routes & Pages](#routes--pages)
- [Components](#components)
- [Database Schema](#database-schema)
  - [Tables](#tables)
  - [Enums](#enums)
  - [Relationships](#relationships)
- [OCR Pipeline](#ocr-pipeline)
  - [How It Works](#how-it-works)
  - [Supported Bill Formats](#supported-bill-formats)
- [Business Logic](#business-logic)
  - [VAT Calculation](#vat-calculation)
  - [Bill Workflow](#bill-workflow)
  - [Vendor Matching](#vendor-matching)
  - [Ledger Posting](#ledger-posting)
- [Master Data](#master-data)
- [Authentication](#authentication)
- [Styling & Theme](#styling--theme)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Ledgerly** is a full-stack Mini ERP application designed for small businesses to manage purchase bills, vendor relationships, inventory tracking, and fixed asset management. It features AI-powered bill capture using Gemini 3.5 Flash, which extracts vendor details, line items, and financial data from uploaded bill images or PDFs in seconds.

| Detail | Value |
|--------|-------|
| **App Name** | Ledgerly |
| **Project ID** | `zjbpuishfacgvvrrjhoz` |
| **Frontend URL** | `http://localhost:8083` |
| **OCR Service URL** | `http://localhost:8001` |
| **Git Remote** | `https://github.com/pratikbudhachettri7-png/Pratik69.git` |

---

## Features

### Bill Management
- Upload bill images (JPG/PNG) or PDFs for AI-powered extraction
- Sync OCR processing via Gemini (3-5 seconds per bill)
- Auto-fill vendor, date, amounts from extracted data
- Line items table with quantity, rate, VAT, and amount
- Save as draft or approve directly
- Duplicate bill detection (same vendor + bill number)
- Bill attachment storage via Supabase Storage
- Collapsible raw OCR text panel for manual verification

### Vendor Management
- Vendor master with VAT number, PAN, contact details
- Auto-create vendors from OCR-extracted data
- Vendor matching by VAT/PAN (exact) or name (fuzzy)
- Payment terms tracking

### Inventory Management
- Item master with code, name, UOM, rates, VAT
- Stock quantity tracking
- Reorder level alerts
- Warehouse location
- Alternate UOM with conversion factor
- Service vs. inventory item distinction

### Fixed Assets
- Asset master with code, name, category
- Purchase cost and depreciation tracking
- Depreciation methods: Straight Line, Declining Balance, Units of Production
- PAN tracking for high-value assets

### Vendor Ledger
- Debit/credit tracking per vendor
- Running balance calculation
- Filter by vendor, search by description
- Linked to bills for audit trail

### Dashboard
- Count cards for all entity types (companies, customers, vendors, items, assets, bills)
- Recent bills list with vendor name and formatted amounts

### Companies & Customers
- Company master with VAT, PAN, state, contact
- Customer master with VAT, billing address, state

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.0 | UI framework |
| TanStack Start | 1.168.26 | SSR framework |
| TanStack Router | 1.170.16 | File-based routing |
| TanStack React Query | 5.101.1 | Server state management |
| Tailwind CSS | 4.2.1 | Utility-first CSS |
| shadcn/ui | New York style | UI component library |
| Radix UI | Various | Headless UI primitives |
| React Hook Form | 7.71.2 | Form management |
| Zod | 3.24.2 | Schema validation |
| Recharts | 2.15.4 | Charts |
| Lucide React | 0.575.0 | Icons |
| Sonner | 2.0.7 | Toast notifications |
| Vite | 8.0.16 | Build tool |
| Bun | Latest | Package manager |

### Backend

| Technology | Purpose |
|-----------|---------|
| Supabase | Database, auth, storage |
| Python FastAPI | OCR microservice |
| Gemini 3.5 Flash | AI-powered OCR and data extraction |
| pypdfium2 | PDF to image conversion |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (React)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  BillForm    │  │ MasterCrud   │  │   Dashboard   │  │
│  │  (upload +   │  │ Pages        │  │   (counts +   │  │
│  │   AI extract)│  │              │  │    recent)    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                               │
│         │ TanStack Server Functions (RPC)                 │
│         │                 │                               │
└─────────┼─────────────────┼───────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────┐
│       TanStack Start (Nitro SSR)    │
│  ┌─────────────────────────────┐    │
│  │  bill-extract.functions.ts  │    │
│  │  - extractBillFromFile()    │    │
│  └──────────┬──────────────────┘    │
│             │                       │
│  ┌──────────▼──────────────────┐    │
│  │  Supabase Client            │    │
│  │  (service role for server)  │    │
│  └──────────┬──────────────────┘    │
└─────────────┼───────────────────────┘
              │
              ▼
┌──────────────────────────┐    ┌──────────────────────┐
│  Supabase (PostgreSQL)   │    │  Python FastAPI       │
│  - bills, bill_lines     │◄───│  (port 8001)          │
│  - vendors, items        │    │  - Gemini 3.5 Flash   │
│  - fixed_assets          │    │  - /ocr (sync)        │
│  - ledgers               │    │  - /ocr/base64        │
│  - companies, customers  │    │  - /health            │
│  - bill-attachments      │    └──────────────────────┘
│    (Storage bucket)      │
└──────────────────────────┘
```

---

## Getting Started

### Prerequisites

| Requirement | Version | Install |
|------------|---------|---------|
| **Node.js** | 18+ | `brew install node` |
| **Bun** | Latest | `curl -fsSL https://bun.sh/install \| bash` |
| **Python** | 3.12 | `brew install python@3.12` |
| **Gemini API Key** | Free | [aistudio.google.com](https://aistudio.google.com) |
| **Supabase** | Hosted | [supabase.com](https://supabase.com) |

### Installation

```bash
# Clone the repository
git clone https://github.com/pratikbudhachettri7-png/Pratik69.git
cd businessfriend-main

# Install frontend dependencies
bun install

# Set up Python virtual environment for OCR
cd services/bill-ocr
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Go back to project root
cd ../..
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
SUPABASE_PROJECT_ID="your-project-id"
SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"

# OCR Service
BILL_OCR_SERVICE_URL="http://localhost:8001"

# Gemini API Key (free from aistudio.google.com)
GEMINI_API_KEY="your-key-here"
```

### Running the App

You need **2 terminal windows** to run the full stack:

#### Terminal 1: Frontend (React + TanStack Start)

```bash
cd /path/to/businessfriend-main
bun run dev
```

Opens at **http://localhost:8083**

#### Terminal 2: OCR Server (Python FastAPI)

```bash
cd /path/to/businessfriend-main/services/bill-ocr
source venv/bin/activate
python server.py
```

Runs at **http://localhost:8001**

#### Verify Everything Works

```bash
# Check frontend
curl -s http://localhost:8083

# Check OCR server
curl -s http://localhost:8001/health
# Should return: {"status":"ok","engine":"gemini","configured":true}
```

---

## Project Structure

```
businessfriend-main/
├── .env                          # Environment variables
├── .gitignore
├── AGENTS.md                     # Lovable agent instructions
├── bun.lock                      # Bun lockfile
├── bunfig.toml                   # Bun config
├── components.json               # shadcn/ui config
├── eslint.config.js              # ESLint config
├── package.json                  # Project manifest
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite + TanStack config
│
├── public/
│   └── favicon.ico
│
├── services/
│   └── bill-ocr/                 # Python OCR microservice
│       ├── server.py             # FastAPI server with Gemini OCR
│       ├── requirements.txt      # Python dependencies
│       └── venv/                 # Python virtual environment
│
├── src/
│   ├── routeTree.gen.ts          # Auto-generated route tree
│   ├── router.tsx                # TanStack Router setup
│   ├── server.ts                 # SSR server entry
│   ├── start.ts                  # TanStack Start config + middleware
│   ├── styles.css                # Global CSS / theme
│   │
│   ├── components/
│   │   ├── AppSidebar.tsx        # Main navigation sidebar
│   │   ├── PageHeader.tsx        # Reusable page header
│   │   ├── bills/
│   │   │   ├── BillForm.tsx      # Bill create/edit (1163 lines)
│   │   │   └── EntityCombobox.tsx # Searchable entity selector
│   │   ├── masters/
│   │   │   ├── MasterCrudPage.tsx # Generic CRUD page
│   │   │   ├── MasterForm.tsx    # Generic master data form
│   │   │   └── schemas.ts        # Zod schemas + field defs
│   │   └── ui/                   # 46 shadcn/ui components
│   │
│   ├── hooks/
│   │   └── use-mobile.tsx        # Responsive breakpoint hook
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── auth-attacher.ts  # Client auth middleware
│   │       ├── auth-middleware.ts # Server auth validation
│   │       ├── client.ts         # Client-side Supabase client
│   │       ├── client.server.ts  # Server-side (service role) client
│   │       └── types.ts          # Database TypeScript types
│   │
│   ├── lib/
│   │   ├── bill-extract.functions.ts # OCR server functions
│   │   ├── data.ts               # React Query option factories
│   │   ├── format.ts             # Number/currency formatting
│   │   ├── vat.ts                # VAT calculation engine
│   │   ├── utils.ts              # cn() utility
│   │   ├── error-capture.ts      # Global error capture
│   │   ├── error-page.ts         # SSR error HTML page
│   │   ├── ai-gateway.server.ts  # Lovable AI gateway client
│   │   └── lovable-error-reporting.ts
│   │
│   └── routes/
│       ├── __root.tsx            # Root layout (shell)
│       ├── index.tsx             # Dashboard (home)
│       ├── bills.index.tsx       # Bills list
│       ├── bills.new.tsx         # New bill form
│       ├── bills.$id.tsx         # Bill detail/edit
│       ├── ledgers.tsx           # Vendor ledger
│       ├── masters.companies.tsx # Companies CRUD
│       ├── masters.customers.tsx # Customers CRUD
│       ├── masters.items.tsx     # Inventory items CRUD
│       ├── masters.vendors.tsx   # Vendors CRUD
│       └── masters.fixed-assets.tsx # Fixed assets CRUD
│
└── supabase/
    └── config.toml               # Supabase project config
```

---

## Routes & Pages

| URL | File | Description |
|-----|------|-------------|
| `/` | `index.tsx` | Dashboard with entity count cards and recent bills |
| `/bills` | `bills.index.tsx` | Bills list with search, type filter, status filter |
| `/bills/new?type=items` | `bills.new.tsx` | New bill form (type: items, services, or fixed_assets) |
| `/bills/:id` | `bills.$id.tsx` | Bill detail/edit page |
| `/ledgers` | `ledgers.tsx` | Vendor ledger with debit/credit/balance |
| `/masters/companies` | `masters.companies.tsx` | Company master CRUD |
| `/masters/customers` | `masters.customers.tsx` | Customer master CRUD |
| `/masters/items` | `masters.items.tsx` | Inventory items master CRUD |
| `/masters/vendors` | `masters.vendors.tsx` | Vendor master CRUD |
| `/masters/fixed-assets` | `masters.fixed-assets.tsx` | Fixed assets master CRUD |

---

## Components

### Application Components

| Component | File | Purpose |
|-----------|------|---------|
| `AppSidebar` | `AppSidebar.tsx` | Main navigation sidebar with groups: Dashboard, Masters, Bills & Purchase |
| `PageHeader` | `PageHeader.tsx` | Reusable page header with title, description, and action buttons |
| `BillForm` | `bills/BillForm.tsx` | Bill create/edit form — handles file upload, OCR extraction, vendor matching, line items table, VAT computation, save/approve workflow |
| `EntityCombobox` | `bills/EntityCombobox.tsx` | Searchable combobox for selecting vendors, items, or assets. Includes inline "Add new" dialog |
| `MasterCrudPage` | `masters/MasterCrudPage.tsx` | Generic CRUD page with table, search, edit dialog, delete confirmation. Reused for all 5 master types |
| `MasterForm` | `masters/MasterForm.tsx` | Generic form using react-hook-form + Zod. Supports text, number, textarea, switch, email, select field types |
| `schemas` | `masters/schemas.ts` | Zod validation schemas and field definitions for all master types |

### UI Components (shadcn/ui)

46 components from shadcn/ui in `src/components/ui/`:
accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip.

---

## Database Schema

### Tables

#### `bills`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `bill_type` | enum | `items`, `services`, `fixed_assets` |
| `tax_type` | text | `vat` or `pan` |
| `vendor_id` | UUID (FK) | References `vendors.id` |
| `company_id` | UUID (FK) | References `companies.id` |
| `bill_number` | text | Vendor's invoice number |
| `invoice_date` | text | Bill date |
| `po_number` | text | Purchase order number |
| `internal_bill_number` | text | Auto-generated `INT-YYYYMM-NNN` |
| `taxable_amount` | numeric | Default 0 |
| `exempted_amount` | numeric | Default 0 |
| `discount` | numeric | Default 0 |
| `transportation` | numeric | Default 0 |
| `other_charges` | numeric | Default 0 |
| `vat_amount` | numeric | Default 0 |
| `final_amount` | numeric | Default 0 |
| `status` | enum | `draft`, `approved` |
| `approved_at` | timestamp | When approved |
| `attachment_url` | text | Signed Supabase storage URL |
| `extracted_json` | jsonb | OCR results: `{status, vendor_name, raw_text, ...}` |
| `notes` | text | User notes |
| `created_at` | timestamp | Auto |
| `updated_at` | timestamp | Auto |

#### `bill_lines`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `bill_id` | UUID (FK) | References `bills.id` |
| `sno` | numeric | Serial number |
| `ref_type` | enum | `item`, `service`, `asset` |
| `ref_id` | UUID (FK) | References `items.id` or `fixed_assets.id` |
| `code` | text | Item/asset code |
| `name` | text | Item/asset name (required) |
| `uom` | text | Unit of measurement |
| `quantity` | numeric | Default 1 |
| `per_unit` | numeric | Rate per unit, default 0 |
| `vat_rate` | numeric | VAT percentage, default 0 |
| `lot_number` | text | Batch/lot number |
| `expiry_date` | text | Expiry date |
| `line_amount` | numeric | Computed: qty × per_unit |
| `created_at` | timestamp | Auto |

#### `vendors`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `name` | text | Required |
| `vat_number` | text | Unique |
| `pan` | text | Unique |
| `contact_person` | text | |
| `email` | text | |
| `phone` | text | |
| `state` | text | |
| `city` | text | |
| `pincode` | text | |
| `address` | text | |
| `payment_terms` | text | e.g., "Net 30" |

#### `items`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `item_code` | text | Unique |
| `item_name` | text | Unique |
| `uom` | text | Default "NOS" |
| `hsn_code` | text | HSN/SAC code |
| `default_rate` | numeric | Purchase price |
| `vat_rate` | numeric | Default 5 |
| `qty` | numeric | Stock quantity |
| `selling_price` | numeric | |
| `reorder_level` | numeric | Alert threshold |
| `warehouse` | text | Location |
| `status` | text | Default "Active" |
| `alt_uom` | text | Alternate unit |
| `alt_uom_conversion` | numeric | Conversion factor |
| `is_service` | boolean | Default false |
| `description` | text | |

#### `fixed_assets`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `asset_code` | text | Unique |
| `asset_name` | text | Unique |
| `category` | text | Furniture/Vehicle/Computer/Machinery/Building/Land/Other |
| `uom` | text | Default "NOS" |
| `hsn_code` | text | |
| `pan` | text | |
| `qty` | integer | Default 0 |
| `purchase_date` | text | |
| `purchase_cost` | numeric | |
| `total_cost` | numeric | |
| `default_rate` | numeric | |
| `vat_rate` | numeric | Default 5 |
| `depreciation_method` | text | Straight Line/Declining Balance/Units of Production |
| `depreciation_rate` | numeric | |
| `status` | text | Default "Active" |
| `description` | text | |

#### `ledgers`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `vendor_id` | UUID (FK) | References `vendors.id` |
| `bill_id` | UUID (FK) | References `bills.id` |
| `date` | text | Transaction date |
| `description` | text | Required |
| `debit` | numeric | Default 0 |
| `credit` | numeric | Default 0 |

#### `companies`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `name` | text | Required |
| `vat_number` | text | |
| `pan` | text | |
| `address` | text | |
| `state` | text | |
| `city` | text | |
| `pincode` | text | |
| `phone` | text | |
| `email` | text | |
| `is_default` | boolean | Default false |

#### `customers`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `name` | text | Required |
| `vat_number` | text | |
| `contact_person` | text | |
| `email` | text | |
| `phone` | text | |
| `state` | text | |
| `city` | text | |
| `pincode` | text | |
| `billing_address` | text | |

### Enums

| Enum | Values |
|------|--------|
| `bill_status` | `draft`, `approved` |
| `bill_type` | `items`, `services`, `fixed_assets` |
| `line_ref_type` | `item`, `service`, `asset` |

### Relationships

```
companies ──────< bills (company_id)
vendors ────────< bills (vendor_id)
vendors ────────< ledgers (vendor_id)
bills ──────────< bill_lines (bill_id)
bills ──────────< ledgers (bill_id)
items ──────────< bill_lines (ref_id, when ref_type="item")
fixed_assets ───< bill_lines (ref_id, when ref_type="asset")
```

### Supabase Storage

| Bucket | Purpose |
|--------|---------|
| `bill-attachments` | Stores uploaded bill PDFs and images. Path: `bills/{timestamp}-{filename}`. Signed URLs with 7-day expiry. |

---

## OCR Pipeline

### How It Works

1. **Upload**: User selects a bill image or PDF in the BillForm
2. **Storage**: File is uploaded to Supabase Storage (`bill-attachments` bucket)
3. **OCR**: Frontend calls `POST /ocr` with the file (synchronous, ~3-5 seconds)
4. **Extract**: Gemini 3.5 Flash analyzes the image and returns structured JSON
5. **Validate**: Backend checks math (qty × rate = amount, subtotal + VAT = total)
6. **Fill**: Frontend auto-fills form fields from extracted data
7. **Warn**: If validation errors exist, user sees warnings before saving

### Flow

```
Browser → TanStack Server Function (extractBillFromFile)
  → POST /ocr (multipart/form-data)
  → FastAPI → Gemini 3.5 Flash (image/PDF → structured JSON)
  → Math validation (qty × rate, subtotal + VAT)
  → Returns {extracted: {...}, raw_text: "...", validation_errors: [...]}
  → Frontend applies extraction to form
```

### Supported Bill Formats

The OCR extracts:
- **Vendor name, VAT number, PAN number**
- **Bill number, date, due date**
- **Line items**: item name, quantity, rate, amount, VAT rate, taxable/non-taxable/exempted
- **Subtotal, total VAT, transportation, discount, final amount**

### Math Validation

Backend validates:
- Each line item: `quantity × rate ≈ amount`
- Line items sum ≈ subtotal
- `subtotal + total_vat ≈ final_amount`

Errors are returned as `_validation_errors` and displayed as warnings in the frontend.

### Python Dependencies

```
google-generativeai  # Gemini 3.5 Flash OCR
fastapi              # Web framework
uvicorn              # ASGI server
python-multipart     # File upload support
pillow               # Image processing
```

---

## Business Logic

### VAT Calculation

Located in `src/lib/vat.ts`:

```typescript
// For each line item:
line_amount = quantity × per_unit

// If VAT rate > 0 (VAT-inclusive pricing):
taxable_amount = line_amount / (1 + vat_rate / 100)
vat_amount = line_amount - taxable_amount

// If VAT rate = 0:
taxable_amount = line_amount
vat_amount = 0

// Bill totals:
total_taxable = sum(all line taxable_amounts)
total_vat = sum(all line vat_amounts)
final_amount = total_taxable + total_vat + transportation + other_charges - discount
```

### Bill Workflow

1. **Create**: User uploads bill → OCR extracts data → Form auto-filled
2. **Draft**: User saves as draft (status = "draft")
3. **Approve**: User clicks "Approve & Save" (status = "approved")
4. **Ledger**: On approval, a ledger entry is created:
   - `debit: 0`
   - `credit: final_amount`
   - `description: "Bill {bill_number} from {vendor_name}"`
5. **Unmatched Items**: If line items don't match inventory/fixed asset master, user is prompted to add them

### Vendor Matching

When OCR extracts a vendor name:
1. **Exact VAT match**: Search vendors by `vat_number` (case-insensitive)
2. **Exact PAN match**: Search vendors by `pan` (case-insensitive)
3. **Name match**: Search vendors by `name` (case-insensitive)
4. **Auto-create**: If no match, create a new vendor with extracted details

### Ledger Posting

When a bill is approved:
- Creates a `ledgers` row with `vendor_id`, `bill_id`, date, description
- `credit` = bill's `final_amount` (vendor owes this amount)
- `debit` = 0
- Balance = sum(credits) - sum(debits) for the vendor

---

## Master Data

All 5 master types use the same generic `MasterCrudPage` + `MasterForm` components with type-specific configurations defined in `src/components/masters/schemas.ts`.

### Companies
- Fields: Name, VAT Number, PAN, Address, State, City, Pincode, Phone, Email, Is Default

### Customers
- Fields: Name, VAT Number, Contact Person, Email, Phone, State, City, Pincode, Billing Address

### Vendors
- Fields: Name, VAT Number, PAN, Contact Person, Email, Phone, State, City, Pincode, Address, Payment Terms

### Inventory Items
- Fields: Item Code, Item Name, UOM, HSN Code, Default Rate, VAT Rate, Qty, Selling Price, Reorder Level, Warehouse, Status, Alt UOM, Alt UOM Conversion, Is Service, Description

### Fixed Assets
- Fields: Asset Code, Asset Name, Category, UOM, HSN Code, PAN, Qty, Purchase Date, Purchase Cost, Total Cost, Default Rate, VAT Rate, Depreciation Method, Depreciation Rate, Status, Description

---

## Authentication

The app uses Supabase Auth with JWT Bearer tokens:

1. **Client middleware** (`auth-attacher.ts`): Reads `access_token` from localStorage, attaches as `Authorization: Bearer` header to all server function RPCs
2. **Server middleware** (`auth-middleware.ts`): Validates JWT, extracts claims, passes `{supabase, userId, claims}` to handlers
3. **Registered globally** in `start.ts` via `attachSupabaseAuth`
4. **RLS**: No explicit RLS policies visible — app operates in open mode with anon key

### Supabase Clients

| Client | File | Purpose |
|--------|------|---------|
| `supabase` (client) | `client.ts` | Browser-side, uses anon key, persists session |
| `supabaseAdmin` (server) | `client.server.ts` | Server-side, uses service role key, bypasses RLS |

---

## Styling & Theme

### Color System

| Mode | Background | Primary | Sidebar | Destructive | Success |
|------|-----------|---------|---------|-------------|---------|
| Light | Warm off-white `oklch(0.985)` | Deep navy `oklch(0.29)` | Dark navy `oklch(0.24)` | Red `oklch(0.55 0.22)` | Green `oklch(0.55 0.14)` |
| Dark | Deep navy | Warm off-white | Dark navy | Red | Green |

### Typography
- **Font**: Inter (Google Fonts)
- **Size**: 14px base
- **Headings**: Tight letter-spacing (-0.01em)

### CSS Approach
- Tailwind CSS v4 with `@import "tailwindcss"`
- shadcn/ui CSS variables using `oklch` color space
- Custom dark mode variant
- `tw-animate-css` for animations

---

## Deployment

### Frontend (Vercel/Netlify)

The app uses TanStack Start with Nitro, which can deploy to:
- Vercel (default)
- Netlify
- Cloudflare Workers
- Any Node.js hosting

```bash
bun run build
# Output in .output/ directory
```

### OCR Service (Local)

The Python OCR service runs locally:
- FastAPI on port 8001
- Gemini 3.5 Flash for OCR (requires GEMINI_API_KEY in .env)

### Supabase (Hosted)

- Database: PostgreSQL on Supabase
- Storage: `bill-attachments` bucket
- Auth: Supabase Auth (JWT)

---

## API Reference

### OCR Endpoints (FastAPI, port 8001)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ocr` | Synchronous OCR — file upload, returns extracted data |
| `POST` | `/ocr/base64` | Base64 image OCR — JSON body `{image, filename}` |
| `GET` | `/health` | Health check — returns `{status: "ok", engine: "gemini", configured: true}` |

### Supabase REST API

All data operations go through Supabase's PostgREST API:
- `GET /rest/v1/{table}` — List rows
- `POST /rest/v1/{table}` — Insert row
- `PATCH /rest/v1/{table}?id=eq.{id}` — Update row
- `DELETE /rest/v1/{table}?id=eq.{id}` — Delete row

---

## Troubleshooting

### "Could not find the 'tax_type' column of 'bills' in the schema cache"

This is a Supabase PostgREST schema cache issue. The column exists but the cache is stale.

**Fix**: Hard refresh your browser (`Cmd+Shift+R` on Mac, `Ctrl+Shift+R` on Windows). If that doesn't work, go to Supabase Dashboard → SQL Editor and run any query against the `bills` table.

### OCR server won't start (port 8001 in use)

```bash
lsof -ti :8001 | xargs kill -9
python server.py
```

### Gemini API key not configured

If OCR returns `"GEMINI_API_KEY not configured"`, add your key to `.env`:

```
GEMINI_API_KEY=your-key-here
```

Get a free key from [aistudio.google.com](https://aistudio.google.com) (no credit card needed).

### OCR extraction is inaccurate

Gemini sometimes returns slightly wrong numbers. The backend validates math (qty × rate, subtotal + VAT) and returns `_validation_errors`. Check the "Extraction Warnings" banner in the BillForm and correct any issues before saving.

### Frontend shows no data

1. Check Supabase URL and keys in `.env`
2. Check browser console for errors
3. Verify Supabase project is running at [supabase.com/dashboard](https://supabase.com/dashboard)

### "Address already in use" error

Another process is using the port. Kill it:
```bash
lsof -ti :8083 | xargs kill -9  # Frontend
lsof -ti :8001 | xargs kill -9  # OCR server
```

---

## License

Private project — not for distribution.

---

## Credits

Built with:
- [TanStack Start](https://tanstack.com/start) — React SSR framework
- [Supabase](https://supabase.com) — Backend-as-a-Service
- [Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs) — AI-powered OCR
- [Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs) — AI-powered OCR
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Lovable](https://lovable.dev) — AI-powered development platform
