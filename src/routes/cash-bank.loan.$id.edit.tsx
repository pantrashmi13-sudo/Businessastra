import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

import { LoanForm } from "@/components/cash-bank/LoanForm";

export const Route = createFileRoute("/cash-bank/loan/$id/edit")({
  component: LoanEditPage,
});

function LoanEditPage() {
  const { id } = Route.useParams();

  const { data: loan, isLoading } = useQuery({
    queryKey: ["loan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
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

  if (!loan) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loan not found.
      </div>
    );
  }

  return <LoanForm initial={loan} />;
}
