import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

import { PettyCashForm } from "@/components/cash-bank/PettyCashForm";

export const Route = createFileRoute("/cash-bank/petty-cash/$id/edit")({
  component: PettyCashEditPage,
});

function PettyCashEditPage() {
  const { id } = Route.useParams();

  const { data: pettyCash, isLoading } = useQuery({
    queryKey: ["petty-cash", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petty_cash_accounts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pettyCash) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Petty cash account not found.
      </div>
    );
  }

  return <PettyCashForm initial={pettyCash} />;
}
