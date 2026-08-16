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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BsDatePicker } from "@/components/ui/bs-date-picker";
import { formatDate, adToBsInput, bsInputToAd, type DateFormat } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";

const LOAN_TYPES = [
  { value: "personal", label: "Personal Loan" },
  { value: "business", label: "Business Loan" },
  { value: "home", label: "Home Loan" },
  { value: "vehicle", label: "Vehicle Loan" },
  { value: "education", label: "Education Loan" },
  { value: "other", label: "Other" },
];

interface LoanFormProps {
  initial?: Record<string, unknown> | null;
  viewOnly?: boolean;
}

export function LoanForm({ initial, viewOnly = false }: LoanFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dateFormat = useDateFormat();

  const [loanType, setLoanType] = useState((initial?.loan_type as string) || "personal");
  const [loanName, setLoanName] = useState((initial?.loan_name as string) || "");
  const [principalAmount, setPrincipalAmount] = useState(
    (initial?.principal_amount as number) || 0
  );
  const [interestRate, setInterestRate] = useState((initial?.interest_rate as number) || 0);
  const [loanOpeningDate, setLoanOpeningDate] = useState(
    (initial?.loan_opening_date as string) || new Date().toISOString().split("T")[0]
  );
  const [loanOutstanding, setLoanOutstanding] = useState(
    (initial?.loan_outstanding as number) || 0
  );
  const [lenderName, setLenderName] = useState((initial?.lender_name as string) || "");
  const [emiAmount, setEmiAmount] = useState((initial?.emi_amount as number) || 0);
  const [tenureMonths, setTenureMonths] = useState((initial?.tenure_months as number) || 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        loan_type: loanType,
        loan_name: loanName.trim(),
        principal_amount: principalAmount,
        interest_rate: interestRate,
        loan_opening_date: loanOpeningDate,
        loan_outstanding: loanOutstanding,
        lender_name: lenderName.trim(),
        emi_amount: emiAmount,
        tenure_months: tenureMonths,
      };

      if (initial?.id) {
        const { error } = await supabase
          .from("loans")
          .update(payload)
          .eq("id", initial.id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Loan updated" : "Loan created");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      navigate({ to: "/cash-bank" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <>
      <PageHeader
        title={initial?.id ? "Edit Loan" : "New Loan"}
        description={viewOnly ? "View loan details" : "Add a new loan"}
      />
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loan_type">Loan Type *</Label>
                <Select value={loanType} onValueChange={setLoanType} disabled={viewOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select loan type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOAN_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan_name">Loan Name *</Label>
                <Input
                  id="loan_name"
                  value={loanName}
                  onChange={(e) => setLoanName(e.target.value)}
                  placeholder="e.g., Home Loan - Nabil Bank"
                  disabled={viewOnly}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="principal_amount">Principal Amount *</Label>
                <Input
                  id="principal_amount"
                  type="number"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  disabled={viewOnly}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interest_rate">Interest Rate (%) *</Label>
                <Input
                  id="interest_rate"
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min={0}
                  max={100}
                  step={0.01}
                  disabled={viewOnly}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan_opening_date">Loan Opening Date *</Label>
                <BsDatePicker
                  value={loanOpeningDate}
                  onChange={(v) => setLoanOpeningDate(v)}
                  placeholder="Select date"
                  disabled={viewOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan_outstanding">Loan Outstanding *</Label>
                <Input
                  id="loan_outstanding"
                  type="number"
                  value={loanOutstanding}
                  onChange={(e) => setLoanOutstanding(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  disabled={viewOnly}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lender_name">Lender Name</Label>
                <Input
                  id="lender_name"
                  value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)}
                  placeholder="e.g., Nabil Bank"
                  disabled={viewOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emi_amount">EMI Amount</Label>
                <Input
                  id="emi_amount"
                  type="number"
                  value={emiAmount}
                  onChange={(e) => setEmiAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  disabled={viewOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenure_months">Tenure (Months)</Label>
                <Input
                  id="tenure_months"
                  type="number"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  min={0}
                  disabled={viewOnly}
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
              disabled={saveMutation.isPending || !loanName.trim()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Loan
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
