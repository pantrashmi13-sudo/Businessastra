import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/onboarding")({
  component: CompanyOnboarding,
});

function CompanyOnboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [companyName, setCompanyName] = useState("");
  const [taxType, setTaxType] = useState<"vat" | "pan">("vat");
  const [taxNumber, setTaxNumber] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [dateFormat, setDateFormat] = useState<"ad" | "bs">("ad");

  const saveCompany = useMutation({
    mutationFn: async () => {
      if (!companyName.trim()) {
        throw new Error("Company name is required");
      }
      if (!taxNumber.trim()) {
        throw new Error(`${taxType.toUpperCase()} number is required`);
      }

      const payload = {
        name: companyName.trim(),
        tax_type: taxType,
        vat_number: taxType === "vat" ? taxNumber.trim() : null,
        pan: taxType === "pan" ? taxNumber.trim() : null,
        logo_url: logoUrl.trim() || null,
        date_format: dateFormat,
        is_default: true,
      };

      const { data, error } = await supabase
        .from("companies")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Company created successfully!");
      qc.invalidateQueries({ queryKey: ["companies"] });
      navigate({ to: "/" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to Ledgerly</CardTitle>
          <CardDescription>
            Set up your company to get started. This will be used for invoices and bills.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Pvt Ltd"
            />
          </div>

          {/* Logo URL */}
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL (optional)</Label>
            <Input
              id="logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
            {logoUrl && (
              <div className="mt-2 flex justify-center">
                <img
                  src={logoUrl}
                  alt="Company logo preview"
                  className="h-16 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          {/* Tax Type Selection */}
          <div className="space-y-3">
            <Label>Tax Registration *</Label>
            <RadioGroup
              value={taxType}
              onValueChange={(v) => {
                setTaxType(v as "vat" | "pan");
                setTaxNumber("");
              }}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vat" id="vat" />
                <Label htmlFor="vat" className="cursor-pointer">VAT Number</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pan" id="pan" />
                <Label htmlFor="pan" className="cursor-pointer">PAN Number</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Tax Number */}
          <div className="space-y-2">
            <Label htmlFor="taxNumber">
              {taxType === "vat" ? "VAT" : "PAN"} Number *
            </Label>
            <Input
              id="taxNumber"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder={taxType === "vat" ? "e.g. 27AABCU9603R1ZM" : "e.g. AABCU9603R"}
            />
          </div>

          {/* Date Format Selection */}
          <div className="space-y-3">
            <Label>Reporting Date Format *</Label>
            <RadioGroup
              value={dateFormat}
              onValueChange={(v) => setDateFormat(v as "ad" | "bs")}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ad" id="ad" />
                <Label htmlFor="ad" className="cursor-pointer">
                  AD (Gregorian)
                  <span className="text-xs text-muted-foreground block">2024-01-15</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bs" id="bs" />
                <Label htmlFor="bs" className="cursor-pointer">
                  BS (Bikram Sambat)
                  <span className="text-xs text-muted-foreground block">2080-10-01</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            size="lg"
            onClick={() => saveCompany.mutate()}
            disabled={saveCompany.isPending}
          >
            {saveCompany.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {saveCompany.isPending ? "Saving..." : "Continue to Dashboard"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
