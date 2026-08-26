import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateFormat } from "@/lib/date-conversion";

export interface CompanyRecord {
  id: string;
  name: string;
  tax_type: "vat" | "pan";
  vat_number: string | null;
  pan: string | null;
  logo_url: string | null;
  date_format: DateFormat;
  fy_start_year: number | null;
  fy_start_date: string | null;
  address: string | null;
  state: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
}

const defaultCompany: CompanyRecord = {
  id: "",
  name: "",
  tax_type: "vat",
  vat_number: null,
  pan: null,
  logo_url: null,
  date_format: "ad",
  fy_start_year: null,
  fy_start_date: null,
  address: null,
  state: null,
  city: null,
  pincode: null,
  phone: null,
  email: null,
};

/**
 * Returns the active company record with tax_type, date_format, etc.
 */
export function useCompany(): { company: CompanyRecord; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies" as any)
        .select("*")
        .limit(1)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const row = data?.[0] as Record<string, any> | undefined;
  if (!row) return { company: defaultCompany, isLoading };

  return {
    company: {
      id: row.id,
      name: row.name,
      tax_type: (row.tax_type as "vat" | "pan") || "vat",
      vat_number: row.vat_number,
      pan: row.pan,
      logo_url: row.logo_url,
      date_format: (row.date_format as DateFormat) || "ad",
      fy_start_year: row.fy_start_year ?? null,
      fy_start_date: row.fy_start_date ?? null,
      address: row.address,
      state: row.state,
      city: row.city,
      pincode: row.pincode,
      phone: row.phone,
      email: row.email,
    },
    isLoading,
  };
}
