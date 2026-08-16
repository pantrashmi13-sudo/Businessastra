import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { BankAccountForm } from "@/components/cash-bank/BankAccountForm";
import { BankLedger } from "@/components/cash-bank/BankLedger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/cash-bank/bank/$id")({
  component: BankAccountViewPage,
});

function BankAccountViewPage() {
  const { id } = Route.useParams();

  const { data: bankAccount, isLoading } = useQuery({
    queryKey: ["bank-account", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
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

  if (!bankAccount) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Bank account not found.
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Bank: ${bankAccount.bank_name}`}
        description={`Account: ${bankAccount.account_number}`}
      />
      <div className="space-y-6 p-6">
        <BankAccountForm initial={bankAccount} viewOnly />

        <Card>
          <CardHeader>
            <CardTitle>Bank Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <BankLedger bankAccountId={id} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
