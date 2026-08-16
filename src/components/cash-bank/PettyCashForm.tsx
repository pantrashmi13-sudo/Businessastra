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
import { Textarea } from "@/components/ui/textarea";

interface PettyCashFormProps {
  initial?: Record<string, unknown> | null;
  viewOnly?: boolean;
}

export function PettyCashForm({ initial, viewOnly = false }: PettyCashFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState((initial?.name as string) || "");
  const [description, setDescription] = useState((initial?.description as string) || "");
  const [openingBalance, setOpeningBalance] = useState(
    (initial?.opening_balance as number) || 0
  );
  const [remarks, setRemarks] = useState((initial?.remarks as string) || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        opening_balance: openingBalance,
        current_balance: openingBalance,
        remarks: remarks.trim(),
      };

      if (initial?.id) {
        const { error } = await supabase
          .from("petty_cash_accounts")
          .update(payload)
          .eq("id", initial.id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("petty_cash_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Petty cash updated" : "Petty cash created");
      queryClient.invalidateQueries({ queryKey: ["petty-cash-accounts"] });
      navigate({ to: "/cash-bank" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <>
      <PageHeader
        title={initial?.id ? "Edit Petty Cash" : "New Petty Cash"}
        description={viewOnly ? "View petty cash details" : "Create a new petty cash account"}
      />
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Office Petty Cash"
                  disabled={viewOnly}
                  required
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description of this petty cash account"
                  disabled={viewOnly}
                  rows={3}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Any additional remarks"
                  disabled={viewOnly}
                  rows={2}
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
              disabled={saveMutation.isPending || !name.trim()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Petty Cash
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
