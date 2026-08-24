import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { LoanForm } from "@/components/cash-bank/LoanForm";
import { LoanLedger } from "@/components/cash-bank/LoanLedger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/cash-bank/loan/$id")({
  component: LoanViewPage,
});

function LoanViewPage() {
  const { id } = Route.useParams();

  const { data: loan, isLoading } = useQuery({
    queryKey: ["loan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans" as any)
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

  return (
    <>
      <PageHeader
        title={`Loan: ${loan.loan_name}`}
        description={`Principal: ${inr(loan.principal_amount)} | Outstanding: ${inr(loan.loan_outstanding)}`}
      />
      <div className="space-y-6 p-6">
        <LoanForm initial={loan} viewOnly />

        <Card>
          <CardHeader>
            <CardTitle>Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <LoanLedger loanId={id} openingOutstanding={loan.loan_outstanding} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
