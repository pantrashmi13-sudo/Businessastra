import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { PettyCashForm } from "@/components/cash-bank/PettyCashForm";
import { PettyCashLedger } from "@/components/cash-bank/PettyCashLedger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/cash-bank/petty-cash/$id")({
  component: PettyCashViewPage,
});

function PettyCashViewPage() {
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

  return (
    <>
      <PageHeader
        title={`Petty Cash: ${pettyCash.name}`}
        description="View petty cash details and ledger"
      />
      <div className="space-y-6 p-6">
        <PettyCashForm initial={pettyCash} viewOnly />

        <Card>
          <CardHeader>
            <CardTitle>Petty Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <PettyCashLedger pettyCashId={id} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
