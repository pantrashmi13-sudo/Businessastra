import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Printer } from "lucide-react";
import { inr, num, toNumber } from "@/lib/format";
import { formatDate, adToBsInput } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { BsDatePicker } from "@/components/ui/bs-date-picker";
import { computeSalesInvoiceTotals, type SalesInvoiceLineInput } from "@/lib/vat";
import { numberToWords } from "@/lib/number-words";

export interface InvoiceLineData {
  sno: number;
  ref_id?: string | null;
  code?: string | null;
  name: string;
  uom?: string | null;
  quantity: number;
  per_unit: number;
  vat_rate: number;
}

export interface InvoiceCompanyData {
  name: string;
  vat_number?: string | null;
  pan?: string | null;
  logo_url?: string | null;
  address?: string | null;
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface InvoiceCustomerData {
  name: string;
  vat_number?: string | null;
  billing_address?: string | null;
  state?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface SalesInvoiceProps {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: "pan" | "vat";
  company: InvoiceCompanyData;
  customer: InvoiceCustomerData;
  deliveryAddress?: string | null;
  poReference?: string | null;
  initialLines: InvoiceLineData[];
  initialDiscount?: number;
  challanNumbers?: string[];
  readOnly?: boolean;
  onLinesChange?: (lines: InvoiceLineData[]) => void;
  onInvoiceNumberChange?: (num: string) => void;
  onInvoiceDateChange?: (date: string) => void;
  onSave?: (data: {
    subtotal: number;
    discount: number;
    vat_amount: number;
    total_amount: number;
    lines: InvoiceLineData[];
  }) => void;
}

export function SalesInvoice({
  invoiceNumber,
  invoiceDate,
  invoiceType,
  company,
  customer,
  deliveryAddress,
  poReference,
  initialLines,
  initialDiscount = 0,
  challanNumbers = [],
  readOnly = false,
  onLinesChange,
  onInvoiceNumberChange,
  onInvoiceDateChange,
  onSave,
}: SalesInvoiceProps) {
  const dateFormat = useDateFormat();
  const [discount, setDiscount] = useState(initialDiscount);
  const [lines, setLines] = useState<InvoiceLineData[]>(initialLines);

  const lineInputs: SalesInvoiceLineInput[] = useMemo(
    () => lines.map((l) => ({ quantity: l.quantity, per_unit: l.per_unit, vat_rate: l.vat_rate })),
    [lines],
  );

  const totals = useMemo(
    () => computeSalesInvoiceTotals({ lines: lineInputs, discount }),
    [lineInputs, discount],
  );

  const isVat = invoiceType === "vat";

  const updateLine = (index: number, patch: Partial<InvoiceLineData>) => {
    setLines((prev) => {
      const next = prev.map((l, i) => {
        if (i !== index) return l;
        const updated = { ...l, ...patch };
        if (patch.quantity !== undefined || patch.per_unit !== undefined) {
          updated.quantity = toNumber(patch.quantity ?? l.quantity, 0);
          updated.per_unit = toNumber(patch.per_unit ?? l.per_unit, 0);
        }
        return updated;
      });
      onLinesChange?.(next);
      return next;
    });
  };

  const amountInWords = numberToWords(totals.total_amount);

  const companyAddress = [company.address, company.city, company.state, company.pincode]
    .filter(Boolean)
    .join(", ");

  const customerAddress = [customer.billing_address, customer.city, customer.state]
    .filter(Boolean)
    .join(", ");

  const shipTo = deliveryAddress || customerAddress;

  const handlePrint = () => window.print();

  return (
    <div className="flex flex-col">
      {/* Print Button - hidden in print */}
      <div className="flex justify-end mb-4 no-print">
        <Button onClick={handlePrint} size="sm">
          <Printer className="mr-1 h-4 w-4" /> Print Invoice
        </Button>
        {onSave && (
          <Button
            onClick={() =>
              onSave({
                subtotal: totals.subtotal,
                discount: totals.discount,
                vat_amount: totals.vat_amount,
                total_amount: totals.total_amount,
                lines,
              })
            }
            size="sm"
            className="ml-2"
          >
            Save Invoice
          </Button>
        )}
      </div>

      {/* Invoice Content */}
      <div className="bg-white border rounded-lg p-6 sm:p-8 max-w-[800px] mx-auto invoice-printable">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 border-b pb-4">
          <div className="flex items-start gap-3">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-14 w-14 object-contain rounded"
              />
            ) : (
              <div className="h-14 w-14 rounded bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                {(company.name || "CO").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">{company.name}</h1>
              {companyAddress && (
                <p className="text-xs text-muted-foreground mt-0.5">{companyAddress}</p>
              )}
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                {company.pan && <span>PAN: {company.pan}</span>}
                {company.vat_number && <span>VAT: {company.vat_number}</span>}
              </div>
              {company.phone && (
                <p className="text-xs text-muted-foreground">Phone: {company.phone}</p>
              )}
              {company.email && (
                <p className="text-xs text-muted-foreground">Email: {company.email}</p>
              )}
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-xl font-bold text-primary">
              {isVat ? "TAX INVOICE" : "SALES INVOICE"}
            </h2>
            {isVat && (
              <Badge variant="outline" className="mt-1 text-xs border-primary text-primary">
                VAT
              </Badge>
            )}
            {!isVat && (
              <Badge variant="outline" className="mt-1 text-xs">
                PAN
              </Badge>
            )}
          </div>
        </div>

        {/* Invoice Meta & Party Details */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Left: Bill To */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Bill To
            </p>
            <p className="font-semibold text-sm">{customer.name}</p>
            {customer.vat_number && (
              <p className="text-xs text-muted-foreground">VAT: {customer.vat_number}</p>
            )}
            {customerAddress && (
              <p className="text-xs text-muted-foreground mt-0.5">{customerAddress}</p>
            )}
            {customer.phone && (
              <p className="text-xs text-muted-foreground">Phone: {customer.phone}</p>
            )}
            {customer.email && (
              <p className="text-xs text-muted-foreground">Email: {customer.email}</p>
            )}
          </div>

          {/* Right: Invoice Info */}
          <div className="text-right">
            <div className="mb-2 flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Invoice #:</span>
              {readOnly ? (
                <span className="font-mono font-semibold text-sm">{invoiceNumber}</span>
              ) : (
                <Input
                  className="h-7 w-[160px] text-right text-xs font-mono"
                  value={invoiceNumber}
                  onChange={(e) => onInvoiceNumberChange?.(e.target.value)}
                />
              )}
            </div>
            <div className="mb-2 flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Date:</span>
              {readOnly ? (
                <span className="text-sm">{formatDate(invoiceDate, dateFormat)}</span>
              ) : dateFormat === "bs" ? (
                <BsDatePicker
                  value={invoiceDate}
                  onChange={(adDate) => onInvoiceDateChange?.(adDate)}
                  className="h-7 w-[160px] text-right text-xs"
                />
              ) : (
                <Input
                  type="date"
                  className="h-7 w-[145px] text-right text-xs"
                  value={invoiceDate}
                  onChange={(e) => onInvoiceDateChange?.(e.target.value)}
                />
              )}
            </div>
            {poReference && (
              <div className="mb-2">
                <span className="text-xs text-muted-foreground">PO Ref: </span>
                <span className="text-sm font-mono">{poReference}</span>
              </div>
            )}
            {challanNumbers.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Challans: </span>
                <span className="text-sm font-mono">{challanNumbers.join(", ")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ship To (if different from Bill To) */}
        {shipTo && shipTo !== customerAddress && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Ship To
            </p>
            <p className="text-sm">{shipTo}</p>
          </div>
        )}

        {/* Line Items Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-y">
                <th className="text-left py-2 px-2 w-[40px] text-xs font-semibold">#</th>
                <th className="text-left py-2 px-2 text-xs font-semibold">Description</th>
                <th className="text-left py-2 px-2 w-[60px] text-xs font-semibold">UOM</th>
                <th className="text-right py-2 px-2 w-[80px] text-xs font-semibold">Qty</th>
                <th className="text-right py-2 px-2 w-[100px] text-xs font-semibold">Rate</th>
                <th className="text-right py-2 px-2 w-[110px] text-xs font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const amount = totals.line_outputs[i]?.discounted_amount ?? (line.quantity * line.per_unit);
                return (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="py-2 px-2 text-muted-foreground">{line.sno}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium">{line.name}</div>
                      {line.code && (
                        <div className="text-xs text-muted-foreground font-mono">{line.code}</div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs font-mono">{line.uom || "NOS"}</td>
                    <td className="py-2 px-2 text-right">
                      {readOnly ? (
                        <span className="font-mono">{num(line.quantity)}</span>
                      ) : (
                        <Input
                          type="number"
                          step="any"
                          className="h-7 w-[70px] text-right text-xs font-mono ml-auto"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(i, { quantity: toNumber(e.target.value, 0) })
                          }
                        />
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {readOnly ? (
                        <span className="font-mono">{inr(line.per_unit)}</span>
                      ) : (
                        <Input
                          type="number"
                          step="any"
                          className="h-7 w-[90px] text-right text-xs font-mono ml-auto"
                          value={line.per_unit}
                          onChange={(e) =>
                            updateLine(i, { per_unit: toNumber(e.target.value, 0) })
                          }
                        />
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold font-mono">
                      {inr(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-[280px]">
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{inr(totals.subtotal)}</span>
            </div>

            {isVat && (
              <div className="flex justify-between items-center py-1 text-sm">
                <span className="text-muted-foreground">Discount</span>
                {readOnly ? (
                  <span className="font-mono text-destructive">{discount > 0 ? `-${inr(discount)}` : "—"}</span>
                ) : (
                  <Input
                    type="number"
                    step="any"
                    className="h-7 w-[120px] text-right text-xs font-mono"
                    value={discount || ""}
                    onChange={(e) => setDiscount(toNumber(e.target.value, 0))}
                    placeholder="0.00"
                  />
                )}
              </div>
            )}

            {!isVat && (
              <div className="flex justify-between items-center py-1 text-sm">
                <span className="text-muted-foreground">Discount</span>
                {readOnly ? (
                  <span className="font-mono text-destructive">{discount > 0 ? `-${inr(discount)}` : "—"}</span>
                ) : (
                  <Input
                    type="number"
                    step="any"
                    className="h-7 w-[120px] text-right text-xs font-mono"
                    value={discount || ""}
                    onChange={(e) => setDiscount(toNumber(e.target.value, 0))}
                    placeholder="0.00"
                  />
                )}
              </div>
            )}

            <div className="flex justify-between py-1 text-sm border-t mt-1 pt-2">
              <span className="text-muted-foreground">Taxable Amount</span>
              <span className="font-mono font-medium">{inr(totals.taxable)}</span>
            </div>

            {isVat && (
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted-foreground">VAT</span>
                <span className="font-mono">{inr(totals.vat_amount)}</span>
              </div>
            )}

            <div className="flex justify-between py-2 text-base font-bold border-t mt-1">
              <span>Grand Total</span>
              <span className="text-primary">{inr(totals.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="mb-6 p-3 bg-muted/30 rounded border">
          <p className="text-xs text-muted-foreground mb-0.5">Amount in Words</p>
          <p className="text-sm font-medium">{amountInWords}</p>
        </div>

        {/* Terms & Signatory */}
        <div className="grid grid-cols-2 gap-6 mt-8">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Terms &amp; Conditions
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Payment is due within 30 days of invoice date.</li>
              <li>Goods once sold will not be taken back.</li>
              <li>Subject to local jurisdiction.</li>
              {isVat && <li>VAT as applicable per government regulations.</li>}
            </ol>
          </div>

          <div className="text-right">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Authorized Signatory
            </p>
            <div className="mt-12 border-t border-dashed border-muted-foreground/40 inline-block px-8">
              <p className="text-xs text-muted-foreground">For {company.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .invoice-printable {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
