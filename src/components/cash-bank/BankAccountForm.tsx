import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface BankAccountFormProps {
  initial?: Record<string, unknown> | null;
  viewOnly?: boolean;
}

export function BankAccountForm({ initial, viewOnly = false }: BankAccountFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [bankName, setBankName] = useState((initial?.bank_name as string) || "");
  const [accountNumber, setAccountNumber] = useState((initial?.account_number as string) || "");
  const [accountHolderName, setAccountHolderName] = useState(
    (initial?.account_holder_name as string) || ""
  );
  const [branch, setBranch] = useState((initial?.branch as string) || "");
  const [openingBalance, setOpeningBalance] = useState(
    (initial?.opening_balance as number) || 0
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_holder_name: accountHolderName.trim(),
        branch: branch.trim(),
        opening_balance: openingBalance,
        current_balance: openingBalance,
      };

      if (initial?.id) {
        const { error } = await supabase
          .from("bank_accounts")
          .update(payload)
          .eq("id", initial.id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Bank account updated" : "Bank account created");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      navigate({ to: "/cash-bank" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <>
      <PageHeader
        title={initial?.id ? "Edit Bank Account" : "New Bank Account"}
        description={viewOnly ? "View bank account details" : "Add a new bank account"}
      />
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name *</Label>
                <Input
                  id="bank_name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., Nepal Bank Limited"
                  disabled={viewOnly}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number *</Label>
                <Input
                  id="account_number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g., 0123456789"
                  disabled={viewOnly}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_holder_name">Account Holder Name</Label>
                <Input
                  id="account_holder_name"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="e.g., John Doe"
                  disabled={viewOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g., Main Branch"
                  disabled={viewOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening_balance">Opening Balance *</Label>
                <Input
                  id="opening_balance"
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  disabled={viewOnly}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {!viewOnly && (
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/cash-bank" })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !bankName.trim() || !accountNumber.trim()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Bank Account
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
