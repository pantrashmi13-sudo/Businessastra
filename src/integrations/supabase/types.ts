export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      bill_lines: {
        Row: {
          bill_id: string;
          code: string | null;
          created_at: string;
          expiry_date: string | null;
          id: string;
          line_amount: number;
          lot_number: string | null;
          name: string;
          per_unit: number;
          quantity: number;
          ref_id: string | null;
          ref_type: Database["public"]["Enums"]["line_ref_type"] | null;
          sno: number;
          uom: string | null;
          vat_rate: number;
        };
        Insert: {
          bill_id: string;
          code?: string | null;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          line_amount?: number;
          lot_number?: string | null;
          name: string;
          per_unit?: number;
          quantity?: number;
          ref_id?: string | null;
          ref_type?: Database["public"]["Enums"]["line_ref_type"] | null;
          sno?: number;
          uom?: string | null;
          vat_rate?: number;
        };
        Update: {
          bill_id?: string;
          code?: string | null;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          line_amount?: number;
          lot_number?: string | null;
          name?: string;
          per_unit?: number;
          quantity?: number;
          ref_id?: string | null;
          ref_type?: Database["public"]["Enums"]["line_ref_type"] | null;
          sno?: number;
          uom?: string | null;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "bill_lines_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
        ];
      };
      bills: {
        Row: {
          approved_at: string | null;
          attachment_url: string | null;
          bill_number: string | null;
          bill_type: Database["public"]["Enums"]["bill_type"];
          company_id: string | null;
          created_at: string;
          discount: number;
          exempted_amount: number;
          extracted_json: Json | null;
          final_amount: number;
          id: string;
          internal_bill_number: string | null;
          invoice_date: string | null;
          notes: string | null;
          other_charges: number;
          po_number: string | null;
          status: Database["public"]["Enums"]["bill_status"];
          tax_type: string | null;
          taxable_amount: number;
          transportation: number;
          updated_at: string;
          vat_amount: number;
          vendor_id: string | null;
        };
        Insert: {
          approved_at?: string | null;
          attachment_url?: string | null;
          bill_number?: string | null;
          bill_type: Database["public"]["Enums"]["bill_type"];
          company_id?: string | null;
          created_at?: string;
          discount?: number;
          exempted_amount?: number;
          extracted_json?: Json | null;
          final_amount?: number;
          id?: string;
          internal_bill_number?: string | null;
          invoice_date?: string | null;
          notes?: string | null;
          other_charges?: number;
          po_number?: string | null;
          status?: Database["public"]["Enums"]["bill_status"];
          tax_type?: string | null;
          taxable_amount?: number;
          transportation?: number;
          updated_at?: string;
          vat_amount?: number;
          vendor_id?: string | null;
        };
        Update: {
          approved_at?: string | null;
          attachment_url?: string | null;
          bill_number?: string | null;
          bill_type?: Database["public"]["Enums"]["bill_type"];
          company_id?: string | null;
          created_at?: string;
          discount?: number;
          exempted_amount?: number;
          extracted_json?: Json | null;
          final_amount?: number;
          id?: string;
          internal_bill_number?: string | null;
          invoice_date?: string | null;
          notes?: string | null;
          other_charges?: number;
          po_number?: string | null;
          status?: Database["public"]["Enums"]["bill_status"];
          tax_type?: string | null;
          taxable_amount?: number;
          transportation?: number;
          updated_at?: string;
          vat_amount?: number;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bills_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bills_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_default: boolean;
          name: string;
          pan: string | null;
          phone: string | null;
          pincode: string | null;
          state: string | null;
          updated_at: string;
          vat_number: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          pan?: string | null;
          phone?: string | null;
          pincode?: string | null;
          state?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          pan?: string | null;
          phone?: string | null;
          pincode?: string | null;
          state?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          billing_address: string | null;
          city: string | null;
          contact_person: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          payment_terms_days: number | null;
          phone: string | null;
          pincode: string | null;
          state: string | null;
          updated_at: string;
          vat_number: string | null;
        };
        Insert: {
          billing_address?: string | null;
          city?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          payment_terms_days?: number | null;
          phone?: string | null;
          pincode?: string | null;
          state?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Update: {
          billing_address?: string | null;
          city?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          payment_terms_days?: number | null;
          phone?: string | null;
          pincode?: string | null;
          state?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Relationships: [];
      };
      fixed_assets: {
        Row: {
          accumulated_depreciation: number;
          asset_code: string;
          asset_name: string;
          book_value: number;
          category: string | null;
          created_at: string;
          default_rate: number;
          depreciation_method: string | null;
          depreciation_rate: number | null;
          description: string | null;
          hsn_code: string | null;
          id: string;
          is_opening: boolean;
          last_depreciation_date: string | null;
          opening_qty: number;
          opening_wdv: number;
          pan: string | null;
          purchase_cost: number;
          purchase_date: string | null;
          qty: number;
          residual_value: number;
          status: string;
          total_cost: number;
          uom: string;
          updated_at: string;
          useful_life: number | null;
          vat_rate: number;
        };
        Insert: {
          accumulated_depreciation?: number;
          asset_code: string;
          asset_name: string;
          book_value?: number;
          category?: string | null;
          created_at?: string;
          default_rate?: number;
          depreciation_method?: string | null;
          depreciation_rate?: number | null;
          description?: string | null;
          hsn_code?: string | null;
          id?: string;
          is_opening?: boolean;
          last_depreciation_date?: string | null;
          opening_qty?: number;
          opening_wdv?: number;
          pan?: string | null;
          purchase_cost?: number;
          purchase_date?: string | null;
          qty?: number;
          residual_value?: number;
          status?: string;
          total_cost?: number;
          uom?: string;
          updated_at?: string;
          useful_life?: number | null;
          vat_rate?: number;
        };
        Update: {
          accumulated_depreciation?: number;
          asset_code?: string;
          asset_name?: string;
          book_value?: number;
          category?: string | null;
          created_at?: string;
          default_rate?: number;
          depreciation_method?: string | null;
          depreciation_rate?: number | null;
          description?: string | null;
          hsn_code?: string | null;
          id?: string;
          is_opening?: boolean;
          last_depreciation_date?: string | null;
          opening_qty?: number;
          opening_wdv?: number;
          pan?: string | null;
          purchase_cost?: number;
          purchase_date?: string | null;
          qty?: number;
          residual_value?: number;
          status?: string;
          total_cost?: number;
          uom?: string;
          updated_at?: string;
          useful_life?: number | null;
          vat_rate?: number;
        };
        Relationships: [];
      };
      items: {
        Row: {
          alt_uom: string | null;
          alt_uom_conversion: number | null;
          category: string | null;
          parent_category: string | null;
          sub_parent_category: string | null;
          sub_category: string | null;
          created_at: string;
          default_rate: number;
          description: string | null;
          hsn_code: string | null;
          id: string;
          is_service: boolean;
          is_inventory: boolean;
          item_code: string;
          item_name: string;
          qty: number;
          reorder_level: number;
          selling_price: number;
          uom: string;
          updated_at: string;
          vat_rate: number;
          warehouse: string | null;
          warehouse_id: string | null;
          rag_number: string | null;
          rag_id: string | null;
          status: string;
          opening_qty: number;
          opening_rate: number;
          opening_value: number;
          sales_ledger: string | null;
          purchase_ledger: string | null;
          tds_applicable: boolean | null;
          tds_rate: number | null;
        };
        Insert: {
          alt_uom?: string | null;
          alt_uom_conversion?: number | null;
          category?: string | null;
          parent_category?: string | null;
          sub_parent_category?: string | null;
          sub_category?: string | null;
          created_at?: string;
          default_rate?: number;
          description?: string | null;
          hsn_code?: string | null;
          id?: string;
          is_service?: boolean;
          is_inventory?: boolean;
          item_code: string;
          item_name: string;
          qty?: number;
          reorder_level?: number;
          selling_price?: number;
          uom?: string;
          updated_at?: string;
          vat_rate?: number;
          warehouse?: string | null;
          warehouse_id?: string | null;
          rag_number?: string | null;
          rag_id?: string | null;
          status?: string;
          opening_qty?: number;
          opening_rate?: number;
          opening_value?: number;
          sales_ledger?: string | null;
          purchase_ledger?: string | null;
          tds_applicable?: boolean | null;
          tds_rate?: number | null;
        };
        Update: {
          alt_uom?: string | null;
          alt_uom_conversion?: number | null;
          category?: string | null;
          parent_category?: string | null;
          sub_parent_category?: string | null;
          sub_category?: string | null;
          created_at?: string;
          default_rate?: number;
          description?: string | null;
          hsn_code?: string | null;
          id?: string;
          is_service?: boolean;
          is_inventory?: boolean;
          item_code?: string;
          item_name?: string;
          qty?: number;
          reorder_level?: number;
          selling_price?: number;
          uom?: string;
          updated_at?: string;
          vat_rate?: number;
          warehouse?: string | null;
          warehouse_id?: string | null;
          rag_number?: string | null;
          rag_id?: string | null;
          status?: string;
          opening_qty?: number;
          opening_rate?: number;
          opening_value?: number;
          sales_ledger?: string | null;
          purchase_ledger?: string | null;
          tds_applicable?: boolean | null;
          tds_rate?: number | null;
        };
        Relationships: [];
      };
      ledgers: {
        Row: {
          id: string;
          vendor_id: string;
          bill_id: string | null;
          date: string;
          description: string;
          debit: number;
          credit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          bill_id?: string | null;
          date?: string;
          description: string;
          debit?: number;
          credit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          bill_id?: string | null;
          date?: string;
          description?: string;
          debit?: number;
          credit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledgers_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledgers_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
        ];
      };
      vendors: {
        Row: {
          address: string | null;
          city: string | null;
          contact_person: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          pan: string | null;
          payment_terms: string | null;
          phone: string | null;
          pincode: string | null;
          state: string | null;
          updated_at: string;
          vat_number: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          pan?: string | null;
          payment_terms?: string | null;
          phone?: string | null;
          pincode?: string | null;
          state?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          pan?: string | null;
          payment_terms?: string | null;
          phone?: string | null;
          pincode?: string | null;
          state?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Relationships: [];
      };
      warehouses: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          location: string | null;
          incharge_person: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          location?: string | null;
          incharge_person?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          location?: string | null;
          incharge_person?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouse_rags: {
        Row: {
          id: string;
          warehouse_id: string;
          name: string;
          code: string | null;
          description: string | null;
          capacity: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          warehouse_id: string;
          name: string;
          code?: string | null;
          description?: string | null;
          capacity?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          warehouse_id?: string;
          name?: string;
          code?: string | null;
          description?: string | null;
          capacity?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_rags_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_transfers: {
        Row: {
          id: string;
          transfer_number: string;
          from_warehouse_id: string;
          to_warehouse_id: string;
          transfer_date: string;
          status: string;
          notes: string | null;
          company_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transfer_number: string;
          from_warehouse_id: string;
          to_warehouse_id: string;
          transfer_date?: string;
          status?: string;
          notes?: string | null;
          company_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          transfer_number?: string;
          from_warehouse_id?: string;
          to_warehouse_id?: string;
          transfer_date?: string;
          status?: string;
          notes?: string | null;
          company_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey";
            columns: ["from_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey";
            columns: ["to_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_transfer_lines: {
        Row: {
          id: string;
          transfer_id: string;
          item_id: string;
          quantity: number;
          from_rag_id: string | null;
          to_rag_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transfer_id: string;
          item_id: string;
          quantity: number;
          from_rag_id?: string | null;
          to_rag_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          transfer_id?: string;
          item_id?: string;
          quantity?: number;
          from_rag_id?: string | null;
          to_rag_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_transfer_lines_transfer_id_fkey";
            columns: ["transfer_id"];
            isOneToOne: false;
            referencedRelation: "stock_transfers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfer_lines_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfer_lines_from_rag_id_fkey";
            columns: ["from_rag_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_rags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfer_lines_to_rag_id_fkey";
            columns: ["to_rag_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_rags";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_vouchers: {
        Row: {
          id: string;
          company_id: string | null;
          voucher_number: string;
          payee_type: Database["public"]["Enums"]["payee_type"];
          vendor_id: string | null;
          payee_name: string | null;
          payment_mode: string;
          reference_number: string | null;
          payment_date: string;
          total_amount: number;
          adjustment_type: Database["public"]["Enums"]["payment_adjustment_type"];
          remarks: string | null;
          status: Database["public"]["Enums"]["voucher_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          voucher_number: string;
          payee_type?: Database["public"]["Enums"]["payee_type"];
          vendor_id?: string | null;
          payee_name?: string | null;
          payment_mode?: string;
          reference_number?: string | null;
          payment_date?: string;
          total_amount?: number;
          adjustment_type?: Database["public"]["Enums"]["payment_adjustment_type"];
          remarks?: string | null;
          status?: Database["public"]["Enums"]["voucher_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          voucher_number?: string;
          payee_type?: Database["public"]["Enums"]["payee_type"];
          vendor_id?: string | null;
          payee_name?: string | null;
          payment_mode?: string;
          reference_number?: string | null;
          payment_date?: string;
          total_amount?: number;
          adjustment_type?: Database["public"]["Enums"]["payment_adjustment_type"];
          remarks?: string | null;
          status?: Database["public"]["Enums"]["voucher_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_vouchers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_vouchers_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_voucher_bills: {
        Row: {
          id: string;
          payment_voucher_id: string;
          bill_id: string;
          amount_applied: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_voucher_id: string;
          bill_id: string;
          amount_applied?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_voucher_id?: string;
          bill_id?: string;
          amount_applied?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_voucher_bills_payment_voucher_id_fkey";
            columns: ["payment_voucher_id"];
            isOneToOne: false;
            referencedRelation: "payment_vouchers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_voucher_bills_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
        ];
      };
      consumptions: {
        Row: {
          id: string;
          consumption_number: string;
          consumption_date: string | null;
          notes: string | null;
          company_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          consumption_number: string;
          consumption_date?: string | null;
          notes?: string | null;
          company_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          consumption_number?: string;
          consumption_date?: string | null;
          notes?: string | null;
          company_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      consumption_lines: {
        Row: {
          id: string;
          consumption_id: string;
          sno: number;
          ref_id: string | null;
          code: string | null;
          name: string;
          uom: string;
          quantity: number;
          per_unit: number;
          line_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          consumption_id: string;
          sno: number;
          ref_id?: string | null;
          code?: string | null;
          name: string;
          uom?: string;
          quantity?: number;
          per_unit?: number;
          line_amount?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          consumption_id?: string;
          sno?: number;
          ref_id?: string | null;
          code?: string | null;
          name?: string;
          uom?: string;
          quantity?: number;
          per_unit?: number;
          line_amount?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consumption_lines_consumption_id_fkey";
            columns: ["consumption_id"];
            isOneToOne: false;
            referencedRelation: "consumptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consumption_lines_ref_id_fkey";
            columns: ["ref_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_returns: {
        Row: {
          company_id: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          original_bill_id: string;
          return_date: string;
          return_number: string;
          status: string;
          tax_type: string | null;
          taxable_amount: number;
          total_amount: number;
          updated_at: string;
          user_id: string | null;
          vat_amount: number;
          vendor_id: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          original_bill_id: string;
          return_date?: string;
          return_number: string;
          status?: string;
          tax_type?: string | null;
          taxable_amount?: number;
          total_amount?: number;
          updated_at?: string;
          user_id?: string | null;
          vat_amount?: number;
          vendor_id: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          original_bill_id?: string;
          return_date?: string;
          return_number?: string;
          status?: string;
          tax_type?: string | null;
          taxable_amount?: number;
          total_amount?: number;
          updated_at?: string;
          user_id?: string | null;
          vat_amount?: number;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_returns_original_bill_id_fkey";
            columns: ["original_bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_returns_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_return_lines: {
        Row: {
          code: string | null;
          created_at: string;
          id: string;
          line_amount: number;
          name: string;
          original_per_unit: number;
          per_unit: number;
          quantity: number;
          ref_id: string | null;
          return_id: string;
          sno: number;
          uom: string | null;
          vat_rate: number;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          id?: string;
          line_amount?: number;
          name: string;
          original_per_unit?: number;
          per_unit?: number;
          quantity?: number;
          ref_id?: string | null;
          return_id: string;
          sno?: number;
          uom?: string | null;
          vat_rate?: number;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          id?: string;
          line_amount?: number;
          name?: string;
          original_per_unit?: number;
          per_unit?: number;
          quantity?: number;
          ref_id?: string | null;
          return_id?: string;
          sno?: number;
          uom?: string | null;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_return_lines_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "purchase_returns";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_returns: {
        Row: {
          company_id: string | null;
          created_at: string;
          customer_id: string;
          discount: number;
          id: string;
          notes: string | null;
          original_invoice_id: string;
          return_date: string;
          return_number: string;
          status: string;
          subtotal: number;
          total_amount: number;
          updated_at: string;
          user_id: string | null;
          vat_amount: number;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          customer_id: string;
          discount?: number;
          id?: string;
          notes?: string | null;
          original_invoice_id: string;
          return_date?: string;
          return_number: string;
          status?: string;
          subtotal?: number;
          total_amount?: number;
          updated_at?: string;
          user_id?: string | null;
          vat_amount?: number;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          customer_id?: string;
          discount?: number;
          id?: string;
          notes?: string | null;
          original_invoice_id?: string;
          return_date?: string;
          return_number?: string;
          status?: string;
          subtotal?: number;
          total_amount?: number;
          updated_at?: string;
          user_id?: string | null;
          vat_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sales_returns_original_invoice_id_fkey";
            columns: ["original_invoice_id"];
            isOneToOne: false;
            referencedRelation: "sales_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_returns_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_return_lines: {
        Row: {
          code: string | null;
          created_at: string;
          id: string;
          line_amount: number;
          name: string;
          original_per_unit: number;
          per_unit: number;
          quantity: number;
          ref_id: string | null;
          return_id: string;
          sno: number;
          uom: string | null;
          vat_rate: number;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          id?: string;
          line_amount?: number;
          name: string;
          original_per_unit?: number;
          per_unit?: number;
          quantity?: number;
          ref_id?: string | null;
          return_id: string;
          sno?: number;
          uom?: string | null;
          vat_rate?: number;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          id?: string;
          line_amount?: number;
          name?: string;
          original_per_unit?: number;
          per_unit?: number;
          quantity?: number;
          ref_id?: string | null;
          return_id?: string;
          sno?: number;
          uom?: string | null;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sales_return_lines_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "sales_returns";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      bill_status: "draft" | "approved";
      bill_type: "items" | "services" | "fixed_assets" | "other_items";
      line_ref_type: "item" | "service" | "asset";
      payee_type: "vendor" | "other";
      payment_adjustment_type: "bill_wise" | "simple";
      voucher_status: "draft" | "final";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      bill_status: ["draft", "approved"],
      bill_type: ["items", "services", "fixed_assets", "other_items"],
      line_ref_type: ["item", "service", "asset"],
    },
  },
} as const;
