import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateFormat } from "@/lib/date-conversion";

/**
 * Returns the active company's date_format setting ('ad' | 'bs').
 * Defaults to 'ad' if no company found.
 */
export function useDateFormat(): DateFormat {
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("date_format");
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = companies?.[0];
  return (active?.date_format as DateFormat) || "ad";
}
