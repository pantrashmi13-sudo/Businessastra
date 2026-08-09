import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Loader2, CheckCircle2, Save } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { type DateFormat, formatDate, adToBsInput, bsInputToAd } from "@/lib/date-conversion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { EntityCombobox, type EntityOption } from "./EntityCombobox";
import { MasterForm } from "@/components/masters/MasterForm";
import {
  vendorSchema,
  vendorFields,
  itemSchema,
  itemFields,
  fixedAssetSchema,
  fixedAssetFields,
} from "@/components/masters/schemas";
import { computeBillTotals, computeLineAmount } from "@/lib/vat";
import { inr, num, toNumber } from "@/lib/format";
import { extractBillFromFile } from "@/lib/bill-extract.functions";

type BillType = "items" | "services" | "fixed_assets";

interface Line {
  id?: string;
  sno: number;
  ref_id: string | null;
  code: string;
  name: string;
  uom: string;
  quantity: number;
  per_unit: number;
  vat_rate: number;
  lot_number: string;
  expiry_date: string;
}

function toISODate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  
  // Normalize delimiters (replace '/' or '.' with '-')
  let normalized = dateStr.trim().replace(/[\/\.]/g, "-");

  // Check for DD-MM-YYYY format
  const ddmmyyyy = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    normalized = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, "0")}-${ddmmyyyy[1].padStart(2, "0")}`;
  }

  // Check if it is now in YYYY-MM-DD format
  const yyyymmdd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10);
    // If year is between 2035 and 2095, it's a BS date (since current AD is 2026)
    if (year >= 2035 && year <= 2095) {
      const adDate = bsInputToAd(normalized);
      if (adDate) return adDate;
    }
    return normalized;
  }

  return dateStr;
}

interface BillFormProps {
  billId?: string;
  initialType?: BillType;
  initial?: {
    bill: Record<string, unknown> | null;
    lines: Array<Record<string, unknown>>;
  } | null;
  pendingOcrResult?: Record<string, unknown> | null;
}

const TYPE_LABEL: Record<BillType, string> = {
  items: "Items / Inventory",
  services: "Services",
  fixed_assets: "Fixed Assets",
};

const emptyLine = (sno: number): Line => ({
  sno,
  ref_id: null,
  code: "",
  name: "",
  uom: "NOS",
  quantity: 1,
  per_unit: 0,
  vat_rate: 0,
  lot_number: "",
  expiry_date: "",
});

export function BillForm({ billId, initialType = "items", initial, pendingOcrResult }: BillFormProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const existing = initial?.bill;
  const isNew = !billId;

  // Apply pending OCR result passed via sessionStorage (after navigate from new-bill page)
  const pendingOcrAppliedRef = useRef(false);
  const pendingOcrVendorRef = useRef<Awaited<ReturnType<typeof extractBillFromFile>> | null>(null);

  useEffect(() => {
    if (pendingOcrResult && !pendingOcrAppliedRef.current) {
      pendingOcrAppliedRef.current = true;
      const r = pendingOcrResult as Awaited<ReturnType<typeof extractBillFromFile>>;
      // Apply header fields immediately (no vendor dependency)
      applyExtractionHeaders(r);
      // Store for vendor matching once vendors load
      pendingOcrVendorRef.current = r;
      const errs = (pendingOcrResult as any)?.validation_errors;
      if (errs && errs.length > 0) {
        setValidationErrors(errs);
        toast.warning("Some values may be inaccurate — please review highlighted fields.");
      } else {
        toast.success("Bill details extracted — please review and edit as needed.");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOcrResult]);

  const [billType, setBillType] = useState<BillType>(
    (existing?.bill_type as BillType) || initialType,
  );
  const [formSegment, setFormSegment] = useState<1 | 2>(1);
  const billTypeRef = useRef(billType);
  billTypeRef.current = billType;
  const [ocrTaxType, setOcrTaxType] = useState<string | null>(
    (existing?.tax_type as string) ?? null,
  );
  const [vendorId, setVendorId] = useState<string | null>(
    (existing?.vendor_id as string) ?? null,
  );
  const [vendorRow, setVendorRow] = useState<Record<string, unknown> | null>(null);

  const taxType = useMemo<"vat" | "pan">(() => {
    if (vendorRow) {
      if (vendorRow.pan && !vendorRow.vat_number) return "pan";
      if (vendorRow.vat_number && !vendorRow.pan) return "vat";
    }
    if (ocrTaxType === "pan") return "pan";
    if (ocrTaxType === "vat") return "vat";
    if (existing?.tax_type === "pan") return "pan";
    return "vat";
  }, [vendorRow, ocrTaxType, existing]);
  const [billNumber, setBillNumber] = useState<string>((existing?.bill_number as string) ?? "");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    (existing?.invoice_date as string) ?? "",
  );
  const [poNumber, setPoNumber] = useState<string>((existing?.po_number as string) ?? "");
  const [internalBillNumber, setInternalBillNumber] = useState<string>(
    (existing?.internal_bill_number as string) ?? "",
  );
  const [notes, setNotes] = useState<string>((existing?.notes as string) ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(
    (existing?.attachment_url as string) ?? null,
  );
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);

  const [exempted, setExempted] = useState<number>(Number(existing?.exempted_amount ?? 0));
  const [discount, setDiscount] = useState<number>(Number(existing?.discount ?? 0));
  const [transportation, setTransportation] = useState<number>(
    Number(existing?.transportation ?? 0),
  );
  const [otherCharges, setOtherCharges] = useState<number>(Number(existing?.other_charges ?? 0));
  const [manualVat, setManualVat] = useState<number | null>(
    existing?.vat_amount != null ? Number(existing.vat_amount) : null,
  );

  const [lines, setLines] = useState<Line[]>(() => {
    if (initial?.lines?.length) {
      return initial.lines.map((l, i) => ({
        id: l.id as string,
        sno: (l.sno as number) ?? i + 1,
        ref_id: (l.ref_id as string) ?? null,
        code: (l.code as string) ?? "",
        name: (l.name as string) ?? "",
        uom: (l.uom as string) ?? "NOS",
        quantity: Number(l.quantity ?? 1),
        per_unit: Number(l.per_unit ?? 0),
        vat_rate: Number(l.vat_rate ?? 0),
        lot_number: (l.lot_number as string) ?? "",
        expiry_date: (l.expiry_date as string) ?? "",
      }));
    }
    return [emptyLine(1)];
  });

  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);
  const [showOcrText, setShowOcrText] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);

  // Master sync & confirmation state
  const [extractedVendorData, setExtractedVendorData] = useState<{
    name: string;
    vat_number?: string | null;
    pan?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    state?: string | null;
    city?: string | null;
    pincode?: string | null;
  } | null>(null);

  const [showApprovalConfirmModal, setShowApprovalConfirmModal] = useState(false);
  const [syncVendorToMaster, setSyncVendorToMaster] = useState(true);
  const [linesToSyncMaster, setLinesToSyncMaster] = useState<Record<string, boolean>>({});
  const [editingMasterItemIndex, setEditingMasterItemIndex] = useState<number | null>(null);
  const [syncedItemMap, setSyncedItemMap] = useState<Record<number, boolean>>({});

  // Auto-suggest internal bill number for new bills
  useEffect(() => {
    if (!isNew) return;
    if (internalBillNumber) return;
    const d = new Date();
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    setInternalBillNumber(`INT-${ym}-${Math.floor(Math.random() * 900 + 100)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data loads
  const vendors = useQuery({
    queryKey: ["vendors", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Deferred vendor matching — runs once vendors data is loaded after OCR
  useEffect(() => {
    if (pendingOcrVendorRef.current && vendors.data) {
      const r = pendingOcrVendorRef.current;
      pendingOcrVendorRef.current = null;
      applyExtractionVendor(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors.data]);

  const items = useQuery({
    queryKey: ["items", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("item_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const assets = useQuery({
    queryKey: ["fixed_assets", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixed_assets").select("*").order("asset_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const companies = useQuery({
    queryKey: ["companies", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const vendorOptions: EntityOption[] = useMemo(
    () =>
      (vendors.data ?? []).map((v: Record<string, unknown>) => ({
        id: v.id as string,
        label: v.name as string,
        sublabel: [(v.vat_number as string), (v.pan as string), (v.state as string)].filter(Boolean).join(" · "),
        raw: v,
      })),
    [vendors.data],
  );

  const itemOptions: EntityOption[] = useMemo(() => {
    const source = billType === "services"
      ? (items.data ?? []).filter((i: Record<string, unknown>) => i.is_service)
      : billType === "items"
        ? (items.data ?? []).filter((i: Record<string, unknown>) => !i.is_service)
        : (assets.data ?? []);
    return source.map((i: Record<string, unknown>) => ({
      id: i.id as string,
      label: (i.item_name || i.asset_name) as string,
      sublabel: `${(i.item_code || i.asset_code) as string} · ${(i.uom as string) ?? ""}`,
      raw: i,
    }));
  }, [billType, items.data, assets.data]);

  // Load vendor row when vendorId changes but row not set
  useEffect(() => {
    if (vendorId && !vendorRow) {
      const found = (vendors.data ?? []).find((v) => v.id === vendorId);
      if (found) setVendorRow(found as Record<string, unknown>);
    }
  }, [vendorId, vendorRow, vendors.data]);

  // Auto-fill item code from master when ref_id is set but code is empty
  useEffect(() => {
    const allItems = [
      ...(items.data ?? []),
      ...(assets.data ?? []),
    ] as Record<string, unknown>[];
    if (!allItems.length) return;

    setLines((prev) =>
      prev.map((l) => {
        if (!l.ref_id || l.code) return l; // already has code or no ref
        const masterItem = allItems.find((item) => item.id === l.ref_id);
        if (!masterItem) return l;
        const masterCode = (masterItem.item_code || masterItem.asset_code || "") as string;
        return masterCode ? { ...l, code: masterCode } : l;
      }),
    );
  }, [items.data, assets.data]);

  const activeCompany = useMemo(() => {
    const list = (companies.data ?? []) as Array<Record<string, unknown>>;
    return (list.find((c) => c.is_default) ?? list[0]) as
      | Record<string, unknown>
      | undefined;
  }, [companies.data]);

  const companyDateFormat = (activeCompany?.date_format as DateFormat) || "ad";

  const computedTotals = useMemo(
    () =>
      computeBillTotals({
        lines,
        exempted_amount: exempted,
        discount,
        transportation: billType === "services" ? 0 : transportation,
        other_charges: otherCharges,
      }),
    [lines, exempted, discount, transportation, otherCharges, billType],
  );

  const totals = useMemo(() => {
    if (manualVat !== null) {
      const discountAmt = Number(discount) || 0;
      const transportAmt = billType === "services" ? 0 : Number(transportation) || 0;
      const otherAmt = Number(otherCharges) || 0;
      return {
        taxable_amount: computedTotals.taxable_amount,
        vat_amount: manualVat,
        final_amount: computedTotals.taxable_amount + manualVat + transportAmt + otherAmt - discountAmt,
      };
    }
    return computedTotals;
  }, [computedTotals, manualVat, discount, transportation, otherCharges, billType]);

  // Line handlers
  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  const removeLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, sno: idx + 1 })));

  // Upload + extract
  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      // Upload to storage
      const path = `bills/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("bill-attachments")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("bill-attachments")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      setAttachmentPath(path);
      setAttachmentUrl(signed?.signedUrl ?? null);

      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);

      // OCR FIRST — before creating any draft bill
      setExtracting(true);
      const result = await extractBillFromFile({
        data: {
          file_base64: base64,
          mime_type: file.type || "application/pdf",
          bill_type: billType,
        },
      });
      setExtracting(false);

      // OCR succeeded — create draft and navigate, passing extraction via router state
      let targetBillId = billId;
      if (!targetBillId) {
        const { data: draftBill, error: draftErr } = await supabase
          .from("bills")
          .insert({
            bill_type: billType,
            status: "draft",
            company_id: (activeCompany?.id as string) ?? null,
            attachment_url: signed?.signedUrl ?? null,
          })
          .select()
          .single();
        if (draftErr) throw draftErr;
        targetBillId = draftBill.id as string;
        // Pass OCR result via router state (more reliable than sessionStorage)
        navigate({
          to: "/bills/$id",
          params: { id: targetBillId },
          state: { ocrResult: result } as any,
        });
      } else {
        // Already on the bill page — apply extraction directly
        applyExtractionHeaders(result);
        applyExtractionVendor(result);
        if (result.validation_errors && result.validation_errors.length > 0) {
          setValidationErrors(result.validation_errors);
          toast.warning("Some values may be inaccurate — please review highlighted fields.");
        } else {
          toast.success("Bill details extracted — please review and edit as needed.");
        }
      }

      setUploading(false);
    } catch (e) {
      toast.error((e as Error).message);
      setUploading(false);
      setExtracting(false);
    }
  };

  const applyExtractionHeaders = (r: Awaited<ReturnType<typeof extractBillFromFile>>) => {
    // Store OCR results for display
    if (r.raw_text) {
      setOcrRawText(r.raw_text);
      setShowOcrText(true);
    }

    // Store validation errors
    if (r.validation_errors && r.validation_errors.length > 0) {
      setValidationErrors(r.validation_errors);
    } else {
      setValidationErrors(null);
    }

    // Auto-fill reliable form fields
    if (r.bill_number) setBillNumber(r.bill_number);
    if (r.invoice_date) setInvoiceDate(toISODate(r.invoice_date));
    if (r.po_number) setPoNumber(r.po_number);
    if (typeof r.discount === "number") setDiscount(r.discount);
    if (typeof r.vat_amount === "number") setManualVat(r.vat_amount);
    if (typeof r.transportation === "number") setTransportation(r.transportation);
    if (typeof r.other_charges === "number") setOtherCharges(r.other_charges);
    if (typeof r.exempted_amount === "number") setExempted(r.exempted_amount);

    // Populate line items from OCR, auto-linking to masters
    if (r.lines && r.lines.length > 0) {
      const masterList = billTypeRef.current === "fixed_assets"
        ? (assets.data ?? [])
        : (items.data ?? []);
      const nameField = billTypeRef.current === "fixed_assets" ? "asset_name" : "item_name";
      const codeField = billTypeRef.current === "fixed_assets" ? "asset_code" : "item_code";

      setLines(r.lines.map((l, i) => {
        // Auto-link: match by code first, then by name
        let refId: string | null = null;
        if (l.code) {
          const byCode = masterList.find((m: Record<string, unknown>) =>
            (m[codeField] as string)?.toLowerCase() === l.code!.toLowerCase()
          );
          if (byCode) refId = byCode.id as string;
        }
        if (!refId && l.name) {
          const normalizedName = l.name.trim().toLowerCase();
          const byName = masterList.find((m: Record<string, unknown>) =>
            ((m[nameField] as string) ?? "").trim().toLowerCase() === normalizedName
          );
          if (byName) refId = byName.id as string;
        }

        return {
          id: crypto.randomUUID(),
          sno: i + 1,
          ref_id: refId,
          code: l.code || "",
          name: l.name || "",
          uom: l.uom || "NOS",
          quantity: l.quantity || 1,
          per_unit: l.per_unit || 0,
          vat_rate: l.vat_rate || 0,
          lot_number: l.lot_number || "",
          expiry_date: l.expiry_date || "",
        };
      }));
    }
  };

  const applyExtractionVendor = (r: Awaited<ReturnType<typeof extractBillFromFile>>) => {
    // Vendor matching — validate by VAT/PAN first (strongest match), then by name
    let match = null;
    if (r.vendor_vat_number || r.vendor_pan) {
      match = (vendors.data ?? []).find((v) => {
        if (r.vendor_vat_number && (v.vat_number as string)?.trim().toLowerCase() === r.vendor_vat_number.trim().toLowerCase()) return true;
        if (r.vendor_pan && (v.pan as string)?.trim().toLowerCase() === r.vendor_pan.trim().toLowerCase()) return true;
        return false;
      });
    }

    if (!match && r.vendor_name) {
      const nameNorm = r.vendor_name.trim().toLowerCase();
      match = (vendors.data ?? []).find(
        (v) => (v.name as string).trim().toLowerCase() === nameNorm,
      );
    }

    // Fuzzy fallback: try contains match
    if (!match && r.vendor_name) {
      const nameNorm = r.vendor_name.trim().toLowerCase();
      match = (vendors.data ?? []).find(
        (v) => {
          const vName = (v.name as string).trim().toLowerCase();
          return vName.includes(nameNorm) || nameNorm.includes(vName);
        },
      );
    }

    if (match) {
      setVendorId(match.id as string);
      setVendorRow(match as Record<string, unknown>);
      setExtractedVendorData(null);
    } else if (r.vendor_name || r.vendor_vat_number || r.vendor_pan) {
      const finalName = r.vendor_name?.trim() || `Vendor (VAT/PAN: ${r.vendor_vat_number || r.vendor_pan})`;
      setExtractedVendorData({
        name: finalName,
        vat_number: r.vendor_vat_number || null,
        pan: r.vendor_pan || null,
        address: r.vendor_address || null,
        phone: r.vendor_phone || null,
        email: r.vendor_email || null,
        state: r.vendor_state || null,
        city: r.vendor_city || null,
        pincode: r.vendor_pincode || null,
      });
      toast.info(`Extracted vendor "${finalName}". Confirm adding to Master below.`);
    }
  };

  const handleCreateExtractedVendor = async () => {
    if (!extractedVendorData) return;
    setCreatingVendor(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: newVendor, error } = await supabase
        .from("vendors")
        .insert({
          name: extractedVendorData.name,
          vat_number: extractedVendorData.vat_number || null,
          pan: extractedVendorData.pan || null,
          address: extractedVendorData.address || null,
          phone: extractedVendorData.phone || null,
          email: extractedVendorData.email || null,
          state: extractedVendorData.state || null,
          city: extractedVendorData.city || null,
          pincode: extractedVendorData.pincode || null,
        } as never)
        .select()
        .single();
      if (error) throw error;
      setVendorId(newVendor.id as string);
      setVendorRow(newVendor as Record<string, unknown>);
      setExtractedVendorData(null);
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(`Vendor "${extractedVendorData.name}" added to Master`);
    } catch (e) {
      toast.error(`Failed to create vendor: ${(e as Error).message}`);
    } finally {
      setCreatingVendor(false);
    }
  };

  const save = useMutation({
    mutationFn: async (opts: { approve: boolean; syncMasters?: boolean; lineIndicesToSync?: number[]; redirectToMasters?: boolean }) => {
      // Validate required fields
      if (!vendorId) {
        throw new Error("Vendor name is required. Please select or add a vendor before saving.");
      }
      const validLines = lines.filter((l) => l.name.trim());
      if (validLines.length === 0) {
        throw new Error("At least one item is required. Please add at least one line item before saving.");
      }

      const payload: Record<string, unknown> = {
        bill_type: billType,
        vendor_id: vendorId,
        company_id: (activeCompany?.id as string) ?? null,
        bill_number: billNumber || null,
        invoice_date: invoiceDate || null,
        po_number: poNumber || null,
        internal_bill_number: internalBillNumber || null,
        taxable_amount: totals.taxable_amount,
        exempted_amount: toNumber(exempted),
        discount: toNumber(discount),
        transportation: billType === "services" ? 0 : toNumber(transportation),
        other_charges: toNumber(otherCharges),
        vat_amount: totals.vat_amount,
        final_amount: totals.final_amount,
        status: (opts.approve ? "approved" : "draft") as "approved" | "draft",
        approved_at: opts.approve ? new Date().toISOString() : null,
        attachment_url: attachmentUrl,
        notes: notes || null,
        extracted_json: (() => {
          if (!ocrRawText) return null;
          try { return JSON.parse(ocrRawText); } catch { return { raw: ocrRawText }; }
        })(),
      };

      // ── Duplicate bill check (runs for BOTH new bills AND first-time saves of OCR drafts) ──
      if (billNumber) {
        const candidateVendorIds = new Set<string>();
        if (vendorId) {
          candidateVendorIds.add(vendorId);
          const { data: vRow } = await supabase
            .from("vendors")
            .select("vat_number, pan")
            .eq("id", vendorId)
            .maybeSingle();
          // Find vendors with same VAT
          if (vRow?.vat_number) {
            const { data: byVat } = await supabase
              .from("vendors")
              .select("id")
              .eq("vat_number", vRow.vat_number);
            for (const v of byVat ?? []) candidateVendorIds.add(v.id);
          }
          // Find vendors with same PAN
          if (vRow?.pan) {
            const { data: byPan } = await supabase
              .from("vendors")
              .select("id")
              .eq("pan", vRow.pan);
            for (const v of byPan ?? []) candidateVendorIds.add(v.id);
          }
        }

        // Query 1: same bill_number + vendor_id in candidate set
        let foundDup: { id: string; bill_number: string | null; invoice_date: string | null; final_amount: number } | null = null;
        if (candidateVendorIds.size > 0) {
          const { data } = await supabase
            .from("bills")
            .select("id, bill_number, invoice_date, final_amount")
            .eq("bill_number", billNumber)
            .in("vendor_id", [...candidateVendorIds])
            .maybeSingle();
          if (data && data.id !== billId) foundDup = data;
        }
        // Query 2: same bill_number + vendor_id IS NULL (unassigned bills)
        if (!foundDup) {
          const { data } = await supabase
            .from("bills")
            .select("id, bill_number, invoice_date, final_amount")
            .eq("bill_number", billNumber)
            .is("vendor_id", null)
            .maybeSingle();
          if (data && data.id !== billId) foundDup = data;
        }

        if (foundDup) {
          const dateStr = foundDup.invoice_date ? ` dated ${formatDate(foundDup.invoice_date, companyDateFormat)}` : "";
          throw new Error(
            `Duplicate bill detected — Bill #${billNumber}${dateStr} (₹${foundDup.final_amount}) already exists. ` +
            `Please review the existing bill before saving.`,
          );
        }
      }

      let id = billId;
      if (id) {
        const { error } = await supabase.from("bills").update(payload as never).eq("id", id);
        if (error) throw error;
        await supabase.from("bill_lines").delete().eq("bill_id", id);
      } else {
        const { data, error } = await supabase
          .from("bills")
          .insert(payload as never)
          .select("id")
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }

      const linePayloads = lines
        .filter((l) => l.name.trim())
        .map((l) => ({
          bill_id: id!,
          sno: l.sno,
          ref_type: (billType === "items"
            ? "item"
            : billType === "services"
              ? "service"
              : "asset") as "item" | "service" | "asset",
          ref_id: l.ref_id,
          code: l.code || null,
          name: l.name,
          uom: l.uom || null,
          quantity: toNumber(l.quantity, 1),
          per_unit: toNumber(l.per_unit, 0),
          vat_rate: toNumber(l.vat_rate, 0),
          lot_number: l.lot_number || null,
          expiry_date: l.expiry_date || null,
          line_amount: computeLineAmount(l.quantity, l.per_unit),
        }));
      if (linePayloads.length) {
        const { error } = await supabase.from("bill_lines").insert(linePayloads as never);
        if (error) throw error;
      }

      // Post ledger entry when bill is approved and has a vendor
      if (opts.approve && vendorId && id) {
        // Remove any existing ledger entry for this bill to avoid duplicates on re-approve
        await supabase.from("ledgers").delete().eq("bill_id", id);
        const { error: ledgerErr } = await supabase.from("ledgers").insert({
          vendor_id: vendorId,
          bill_id: id,
          date: invoiceDate || new Date().toISOString().slice(0, 10),
          description: `Bill #${billNumber || internalBillNumber || id}`,
          debit: 0,
          credit: totals.final_amount,
        } as never);
        if (ledgerErr) {
          console.error("Ledger entry failed:", ledgerErr);
          // Non-fatal — bill is already saved
        }
      }

      return id;
    },
    onSuccess: async (id, vars) => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["ledgers"] });
      toast.success(vars.approve ? "Bill approved & saved" : "Draft saved");

      // The bill ID to return to (either existing or newly created)
      const billId = id || existing?.id;

      // Auto-create/update master records on approve IF user confirmed master sync
      if (vars.approve && vars.syncMasters !== false) {
        const isFixedAssets = billTypeRef.current === "fixed_assets";
        const isServices = billTypeRef.current === "services";
        const table = isFixedAssets ? "fixed_assets" : "items";
        const codeField = isFixedAssets ? "asset_code" : "item_code";
        const nameField = isFixedAssets ? "asset_name" : "item_name";
        const label = isFixedAssets ? "fixed assets" : isServices ? "services" : "inventory";
        const masterRoute = isFixedAssets ? "/masters/fixed-assets" : "/masters/items";

        const allowedIndices = vars.lineIndicesToSync
          ? new Set(vars.lineIndicesToSync)
          : new Set(lines.map((_, idx) => idx));

        await (async () => {
          let created = 0;
          let updated = 0;

          // ── 1. Increment qty for MATCHED lines ──
          const matched = lines.filter((l, idx) => l.ref_id && l.name.trim() && allowedIndices.has(idx));
          for (const line of matched) {
            const { data: item } = await supabase
              .from(table)
              .select("id, qty")
              .eq("id", line.ref_id!)
              .maybeSingle();
            if (item) {
              const newQty = Number(item.qty || 0) + Number(line.quantity || 0);
              await supabase
                .from(table)
                .update({ qty: newQty } as never)
                .eq("id", item.id);
              updated++;
            }
          }

          // ── 2. Create or update UNMATCHED lines ──
          const unmatched = lines.filter((l, idx) => !l.ref_id && l.name.trim() && allowedIndices.has(idx));
          for (const line of unmatched) {
            const autoCode = (line.code || line.name)
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9 ]/g, "")
              .replace(/\s+/g, "-")
              .slice(0, 50);

            // Normalize name for fuzzy matching
            const normalizedInput = line.name.trim().toLowerCase().replace(/\s+/g, " ");
            const normalizedName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

            const { data: existingCandidates } = await supabase
              .from(table)
              .select("id, qty, is_service")
              .or(`${codeField}.eq.${autoCode},${nameField}.eq.${line.name.trim()}`);

            let existing = isFixedAssets
              ? existingCandidates?.[0] ?? null
              : (existingCandidates as any)?.find((r: any) => r.is_service === isServices) ?? null;

            if (!existing && !isFixedAssets) {
              const fuzzyCandidates = await supabase
                .from(table)
                .select("id, qty, is_service, item_name")
                .like("item_name", `%${line.name.trim().split(/\s+/)[0]}%`);
              const candidates = (fuzzyCandidates.data ?? []) as any[];
              existing = candidates.find((r) =>
                r.is_service === isServices &&
                normalizedName(r.item_name).replace(/\s+/g, " ") === normalizedInput
              ) ?? null;
            }

            if (existing) {
              const newQty = Number(existing.qty || 0) + Number(line.quantity || 1);
              await supabase
                .from(table)
                .update({ qty: newQty } as never)
                .eq("id", existing.id);
              updated++;
            } else {
              const payload: Record<string, unknown> = {
                [codeField]: autoCode,
                [nameField]: line.name.trim(),
                uom: line.uom || "NOS",
                default_rate: line.per_unit,
                vat_rate: line.vat_rate,
                qty: Number(line.quantity) || 1,
              };
              if (!isFixedAssets) {
                payload.is_service = isServices;
              }
              if (isFixedAssets) {
                payload.purchase_date = invoiceDate || null;
                payload.purchase_cost = line.per_unit;
                payload.total_cost = computeLineAmount(line.quantity, line.per_unit);
                payload.category = "Other";
              }
              const { error } = await supabase
                .from(table)
                .insert(payload as never);
              if (!error) created++;
            }
          }
          qc.invalidateQueries({ queryKey: [table] });
          if (created || updated) {
            const parts = [];
            if (created) parts.push(`${created} new`);
            if (updated) parts.push(`${updated} qty updated`);
            toast.success(`${label} ${parts.join(", ")}`);
          }

          // ── 3. Redirect to master page if user chose "Confirm & Edit in Item Master" ──
          if (vars.redirectToMasters && billId) {
            toast.info("Redirecting to Item Master — edit details, then click 'Back to Bill' to return.");
            navigate({
              to: masterRoute,
              search: { returnBillId: billId },
            } as any);
            return; // skip the default navigation below
          }
        })();

        // If we redirected to masters, we already returned above; skip default nav
        if (vars.redirectToMasters) return;
      }

      if (isNew && id) {
        navigate({ to: "/bills/$id", params: { id } });
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteBill = useMutation({
    mutationFn: async () => {
      if (!billId) throw new Error("No bill to delete");
      // Delete bill lines first
      await supabase.from("bill_lines").delete().eq("bill_id", billId);
      // Delete ledger entries
      await supabase.from("ledgers").delete().eq("bill_id", billId);
      // Delete the bill
      const { error } = await supabase.from("bills").delete().eq("id", billId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bill deleted");
      navigate({ to: "/bills" });
    },
    onError: (e) => toast.error(`Failed to delete: ${(e as Error).message}`),
  });

  const isServiceMode = billType === "services";
  const isApproved = existing?.status === "approved";

  const vendorSublabel = vendorRow
    ? [(vendorRow.vat_number as string), (vendorRow.pan as string), (vendorRow.state as string)]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <>
      <PageHeader
        title={isNew ? "New Bill" : `Bill ${billNumber || existing?.internal_bill_number || ""}`}
        description={
          isNew
            ? "Upload a bill for AI extraction, or fill in the fields manually."
            : `Type: ${TYPE_LABEL[billType]} · Status: ${existing?.status ?? "draft"}`
        }
        actions={
          <div className="flex items-center gap-2">
            {isApproved ? (
              <Badge variant="secondary" className="bg-success text-success-foreground">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Approved (Locked)
              </Badge>
            ) : (
              <>
                <Badge variant="outline">Draft</Badge>
                <Button
                  variant="outline"
                  onClick={() => save.mutate({ approve: false })}
                  disabled={save.isPending || creatingVendor}
                >
                  <Save className="mr-1 h-4 w-4" /> Save Draft
                </Button>
                <Button
                  onClick={() => {
                    const initialLinesToSync: Record<string, boolean> = {};
                    lines.forEach((l, idx) => {
                      if (l.name.trim()) initialLinesToSync[idx] = true;
                    });
                    setLinesToSyncMaster(initialLinesToSync);
                    setSyncVendorToMaster(true);
                    setShowApprovalConfirmModal(true);
                  }}
                  disabled={save.isPending || creatingVendor}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Approve &amp; Save
                </Button>
                {!isNew && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this draft bill?")) {
                        deleteBill.mutate();
                      }
                    }}
                    disabled={deleteBill.isPending}
                  >
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {/* Segment 1: OCR + Bill Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Section */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
              <div>
                <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Bill Type
                </Label>
                <Select value={billType} onValueChange={(v) => setBillType(v as BillType)} disabled={!isNew}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="items">Items / Inventory</SelectItem>
                    <SelectItem value="services">Services</SelectItem>
                    <SelectItem value="fixed_assets">Fixed Assets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Upload Bill (PDF or image) — AI will extract details
                </Label>
                <div className="flex items-center gap-2">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    {uploading || extracting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {extracting ? "Extracting with AI…" : "Uploading…"}
                      </span>
                    ) : attachmentUrl ? (
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View uploaded file
                      </a>
                    ) : (
                      <span>Click to upload PDF / JPG / PNG</span>
                    )}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                      }}
                    />
                  </label>
                  {attachmentUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAttachmentUrl(null);
                        setAttachmentPath(null);
                        setOcrRawText(null);
                        setShowOcrText(false);
                        setValidationErrors(null);
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* OCR Extracted Text (collapsible) */}
            {ocrRawText && (
              <div
                className="cursor-pointer select-none rounded-md border border-border bg-muted/30 p-3"
                onClick={() => setShowOcrText(!showOcrText)}
              >
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>OCR Extracted Text</span>
                  <span className="text-xs text-muted-foreground">
                    {showOcrText ? "Click to collapse" : "Click to expand"}
                  </span>
                </div>
                {showOcrText && (
                  <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
                    {ocrRawText}
                  </pre>
                )}
              </div>
            )}

            {/* Validation Errors */}
            {validationErrors && validationErrors.length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">Extraction Warnings</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-destructive">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">
                  Please review and correct any issues before saving.
                </p>
              </div>
            )}

            {/* Vendor */}
            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Vendor *
              </Label>
              <EntityCombobox
                value={vendorId}
                onChange={(id, row) => {
                  setVendorId(id);
                  setVendorRow(row);
                }}
                options={vendorOptions}
                placeholder="Select or add vendor"
                addLabel="Add new vendor"
                table="vendors"
                schema={vendorSchema}
                fields={vendorFields}
                nameKey="name"
                disabled={isApproved}
              />
              {vendorSublabel ? (
                <p className="mt-1 text-xs text-muted-foreground">{vendorSublabel}</p>
              ) : null}
              {extractedVendorData && !vendorId ? (
                <div className="mt-2 rounded-md border border-amber-300 bg-amber-50/80 p-3 text-sm dark:bg-amber-950/40 dark:border-amber-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-amber-600" /> Extracted Vendor: {extractedVendorData.name}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        {[
                          extractedVendorData.vat_number && `VAT: ${extractedVendorData.vat_number}`,
                          extractedVendorData.pan && `PAN: ${extractedVendorData.pan}`,
                          extractedVendorData.phone && `Phone: ${extractedVendorData.phone}`,
                          extractedVendorData.email && `Email: ${extractedVendorData.email}`,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" type="button" onClick={handleCreateExtractedVendor} disabled={creatingVendor}>
                        {creatingVendor ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                        Add to Vendor Master
                      </Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => setExtractedVendorData(null)}>
                        Skip
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bill Fields */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Bill Number">
                <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} disabled={isApproved} />
              </Field>
              <Field label={`Invoice Date (${companyDateFormat.toUpperCase()})`}>
                {companyDateFormat === "bs" ? (
                  <Input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    value={adToBsInput(invoiceDate)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setInvoiceDate("");
                        return;
                      }
                      const adDate = bsInputToAd(val);
                      if (adDate) setInvoiceDate(adDate);
                    }}
                    disabled={isApproved}
                  />
                ) : (
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    disabled={isApproved}
                  />
                )}
              </Field>
              <Field label="PO Number">
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} disabled={isApproved} />
              </Field>
              <Field label="Internal Bill Number">
                <Input
                  value={internalBillNumber}
                  onChange={(e) => setInternalBillNumber(e.target.value)}
                  disabled={isApproved}
                />
              </Field>
            </div>

            {/* Next Button */}
            {!isApproved && formSegment === 1 && (
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (!vendorId) {
                      toast.error("Please select a vendor before continuing.");
                      return;
                    }
                    setFormSegment(2);
                  }}
                >
                  Next: Add Line Items →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Segment 2: Line Items, Totals & Notes */}
        {(isApproved || formSegment === 2) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {!isApproved && formSegment === 2 && (
                <Button size="sm" variant="ghost" onClick={() => setFormSegment(1)}>
                  ← Back
                </Button>
              )}
              <CardTitle className="text-base">Line Items — {TYPE_LABEL[billType]}</CardTitle>
            </div>
            <Button size="sm" variant="outline" onClick={addLine} disabled={isApproved}>
              <Plus className="mr-1 h-4 w-4" /> Add Line
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="table-fixed min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">S.No</TableHead>
                  <TableHead className="w-[260px]">
                    {billType === "fixed_assets" ? "Asset" : billType === "services" ? "Service" : "Item"}
                  </TableHead>
                  <TableHead className="w-[90px]">Code</TableHead>
                  <TableHead className="w-[80px]">UOM</TableHead>
                  <TableHead className="w-[100px] text-right">Qty</TableHead>
                  <TableHead className="w-[110px] text-right">Per Unit</TableHead>
                  <TableHead className="w-[80px] text-right">{taxType === "pan" ? "Tax %" : "VAT %"}</TableHead>
                  <TableHead className="w-[110px]">Lot Number</TableHead>
                  <TableHead className="w-[140px]">Expiry Date</TableHead>
                  <TableHead className="w-[110px] text-right">Line Amount</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => {
                  const lineAmt = computeLineAmount(l.quantity, l.per_unit);
                  return (
                    <TableRow key={i}>
                      <TableCell className="w-[50px] text-muted-foreground align-middle">{l.sno}</TableCell>
                      <TableCell className="w-[260px] align-middle">
                        <EntityCombobox
                          value={l.ref_id}
                          onChange={(id, row) => {
                            if (row) {
                              updateLine(i, {
                                ref_id: id,
                                code: (row.item_code || row.asset_code || "") as string,
                                name: (row.item_name || row.asset_name || "") as string,
                                uom: (row.uom as string) || "NOS",
                                per_unit: Number(row.default_rate) || l.per_unit,
                                vat_rate: Number(row.vat_rate) || l.vat_rate,
                                lot_number: (row.lot_number as string) || l.lot_number,
                                expiry_date: (row.expiry_date as string) || l.expiry_date,
                              });
                            } else {
                              updateLine(i, { ref_id: null });
                            }
                          }}
                          options={itemOptions}
                          placeholder={l.name || "Select…"}
                          addLabel={
                            billType === "fixed_assets"
                              ? "Add new fixed asset"
                              : billType === "services"
                                ? "Add new service"
                                : "Add new item"
                          }
                          table={billType === "fixed_assets" ? "fixed_assets" : "items"}
                          schema={billType === "fixed_assets" ? fixedAssetSchema : itemSchema}
                          fields={billType === "fixed_assets" ? fixedAssetFields : itemFields}
                          nameKey={billType === "fixed_assets" ? "asset_name" : "item_name"}
                          disabled={isApproved}
                        />
                      </TableCell>
                      <TableCell className="w-[90px] align-middle">
                        <Input
                          className={`w-full font-mono text-xs ${l.ref_id && l.code ? "bg-green-50 border-green-300 text-green-800" : ""}`}
                          value={l.code}
                          onChange={(e) => updateLine(i, { code: e.target.value })}
                          title={l.ref_id && l.code ? "Auto-filled from Item Master" : undefined}
                          disabled={isApproved}
                        />
                      </TableCell>
                      <TableCell className="w-[80px] align-middle">
                        <Input
                          className="w-full text-xs"
                          value={l.uom}
                          onChange={(e) => updateLine(i, { uom: e.target.value })}
                          disabled={isApproved}
                        />
                      </TableCell>
                      <TableCell className="w-[100px] align-middle">
                        <Input
                          type="number"
                          step="any"
                          className="w-full text-right"
                          value={l.quantity}
                          onChange={(e) =>
                            updateLine(i, { quantity: toNumber(e.target.value, 0) })
                          }
                          disabled={isApproved}
                        />
                      </TableCell>
                      <TableCell className="w-[110px] align-middle">
                        <Input
                          type="number"
                          step="any"
                          className="w-full text-right"
                          value={l.per_unit}
                          onChange={(e) =>
                            updateLine(i, { per_unit: toNumber(e.target.value, 0) })
                          }
                          disabled={isApproved}
                        />
                      </TableCell>
                      <TableCell className="w-[80px] align-middle">
                        <Input
                          type="number"
                          step="any"
                          className="w-full text-right"
                          value={l.vat_rate}
                          onChange={(e) =>
                            updateLine(i, { vat_rate: toNumber(e.target.value, 0) })
                          }
                          disabled={isApproved}
                        />
                      </TableCell>
                      <TableCell className="w-[110px] align-middle">
                        <Input
                          className="w-full font-mono text-xs"
                          value={l.lot_number}
                          onChange={(e) => updateLine(i, { lot_number: e.target.value })}
                          disabled={isApproved}
                        />
                      </TableCell>
                      <TableCell className="w-[140px] align-middle">
                        <Input
                          type="date"
                          className="w-full text-xs"
                          value={l.expiry_date}
                          onChange={(e) => updateLine(i, { expiry_date: e.target.value })}
                          disabled={isApproved}
                        />
                      </TableCell>
                      <TableCell className="w-[110px] text-right font-medium align-middle">
                        {num(lineAmt)}
                      </TableCell>
                      <TableCell className="w-[40px] align-middle">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeLine(i)}
                          disabled={lines.length === 1 || isApproved}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>

          {/* Totals Section */}
          <div className="border-t">
            <CardContent className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-2">
              <div className="space-y-3">
                <TotalRow label="Taxable Amount" value={inr(totals.taxable_amount)} />
                <NumField label="Exempted Amount" value={exempted} onChange={setExempted} disabled={isApproved} />
                <NumField label="Discount" value={discount} onChange={setDiscount} disabled={isApproved} />
                {!isServiceMode ? (
                  <NumField
                    label="Transportation"
                    value={transportation}
                    onChange={setTransportation}
                    disabled={isApproved}
                  />
                ) : null}
                <NumField label="Other Charges" value={otherCharges} onChange={setOtherCharges} disabled={isApproved} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm">{taxType === "pan" ? "Tax" : "VAT"}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="any"
                      className="w-36 text-right"
                      value={manualVat !== null ? manualVat : totals.vat_amount}
                      onChange={(e) => setManualVat(toNumber(e.target.value, 0))}
                      disabled={isApproved}
                    />
                    {manualVat !== null && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => setManualVat(null)}
                        title="Reset to auto-calculated VAT"
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Final Bill Amount
                  </div>
                  <div className="mt-1 text-3xl font-bold text-primary">
                    {inr(totals.final_amount)}
                  </div>
                </div>
              </div>
            </CardContent>
          </div>

          {/* Notes Section */}
          <div className="border-t">
            <CardContent className="pt-6">
              <Label className="mb-2 block text-sm font-medium">Notes</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this bill…"
                disabled={isApproved}
              />
            </CardContent>
          </div>
        </Card>
        )}
      </div>

      {/* Master Data Sync Confirmation Dialog on Bill Approval */}
      <Dialog open={showApprovalConfirmModal} onOpenChange={setShowApprovalConfirmModal}>
        <DialogContent className="max-w-lg bg-background text-foreground dark:bg-zinc-950 dark:text-zinc-50 border shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground dark:text-zinc-100">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Confirm Master Updates on Approval
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground dark:text-zinc-400">
              Review vendor &amp; item records to add or update in Master database when approving Bill #{billNumber || internalBillNumber || ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Inline Master Form (opens directly above the list when "Edit in Master" is clicked) */}
            {editingMasterItemIndex !== null && (() => {
              const line = lines[editingMasterItemIndex];
              if (!line) return null;

              const isFixedAssets = billType === "fixed_assets";
              const isServices = billType === "services";
              const table = isFixedAssets ? "fixed_assets" : "items";
              const autoCode = (line.code || line.name)
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9 ]/g, "")
                .replace(/\s+/g, "-")
                .slice(0, 50);

              const initialMasterValues: Record<string, unknown> = isFixedAssets
                ? {
                    asset_code: autoCode,
                    asset_name: line.name.trim(),
                    uom: line.uom || "NOS",
                    category: "Other",
                    purchase_date: invoiceDate || new Date().toISOString().slice(0, 10),
                    purchase_cost: line.per_unit,
                    total_cost: computeLineAmount(line.quantity, line.per_unit),
                    qty: Number(line.quantity) || 1,
                  }
                : {
                    item_code: autoCode,
                    item_name: line.name.trim(),
                    uom: line.uom || "NOS",
                    default_rate: line.per_unit,
                    vat_rate: line.vat_rate,
                    qty: Number(line.quantity) || 1,
                    is_service: isServices,
                  };

              return (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/40 p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800 pb-1.5">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      Edit Item Details: {line.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] px-2 text-blue-700 dark:text-blue-300"
                      onClick={() => setEditingMasterItemIndex(null)}
                    >
                      Close Form
                    </Button>
                  </div>
                  <MasterForm
                    table={table}
                    schema={isFixedAssets ? fixedAssetSchema : itemSchema}
                    fields={isFixedAssets ? fixedAssetFields : itemFields}
                    initial={initialMasterValues}
                    onSaved={(createdRow) => {
                      toast.success(`Item "${line.name}" saved to Master!`);
                      // Update line ref_id if created
                      if (createdRow?.id) {
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === editingMasterItemIndex ? { ...l, ref_id: createdRow.id as string } : l,
                          ),
                        );
                      }
                      setSyncedItemMap((prev) => ({ ...prev, [editingMasterItemIndex]: true }));
                      setEditingMasterItemIndex(null);
                      qc.invalidateQueries({ queryKey: [table] });
                    }}
                    onCancel={() => setEditingMasterItemIndex(null)}
                    submitLabel="Save Item to Master"
                  />
                </div>
              );
            })()}

            {/* Vendor confirmation */}
            {extractedVendorData && !vendorId ? (
              <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/40">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="sync-vendor-modal"
                    checked={syncVendorToMaster}
                    onCheckedChange={(c) => setSyncVendorToMaster(!!c)}
                  />
                  <div>
                    <label htmlFor="sync-vendor-modal" className="font-semibold text-xs cursor-pointer block text-foreground dark:text-zinc-200">
                      Add Extracted Vendor to Master
                    </label>
                    <p className="text-[11px] text-muted-foreground dark:text-zinc-400 mt-0.5">
                      {extractedVendorData.name} {extractedVendorData.vat_number ? `(VAT: ${extractedVendorData.vat_number})` : ""}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Line items master updates */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground dark:text-zinc-300 block mb-2">
                Line Items to Add/Update in Masters:
              </Label>
              <div className="max-h-60 overflow-y-auto space-y-2 rounded-md border p-3 bg-card dark:bg-zinc-900/50">
                {lines.filter((l) => l.name.trim()).length === 0 ? (
                  <p className="text-xs text-muted-foreground dark:text-zinc-400">No line items in this bill.</p>
                ) : (
                  lines.map((l, idx) => {
                    if (!l.name.trim()) return null;
                    const isMatched = !!l.ref_id || !!syncedItemMap[idx];
                    const isChecked = linesToSyncMaster[idx] ?? true;

                    return (
                      <div key={idx} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2.5 last:border-0 last:pb-0 text-xs">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <Checkbox
                            id={`sync-line-${idx}`}
                            checked={isChecked}
                            onCheckedChange={(c) => {
                              setLinesToSyncMaster((prev) => ({ ...prev, [idx]: !!c }));
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <label htmlFor={`sync-line-${idx}`} className="font-medium cursor-pointer block truncate text-foreground dark:text-zinc-200">
                              {l.name}
                            </label>
                            <span className="text-[11px] text-muted-foreground dark:text-zinc-400 block">
                              Qty: {l.quantity} {l.uom} · Rate: ₹{l.per_unit}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={isMatched ? "outline" : "default"}
                            className={`text-[10px] ${
                              isMatched
                                ? "border-zinc-300 dark:border-zinc-700 text-muted-foreground dark:text-zinc-400"
                                : "bg-emerald-600 dark:bg-emerald-700 text-white"
                            }`}
                          >
                            {isMatched ? "Update Qty" : "New Item"}
                          </Badge>

                          {!isMatched && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px] px-2 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800"
                              onClick={() => setEditingMasterItemIndex(idx)}
                            >
                              Edit in Master
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowApprovalConfirmModal(false);
                save.mutate({ approve: true, syncMasters: false });
              }}
              disabled={save.isPending}
            >
              Approve Bill Only
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                setShowApprovalConfirmModal(false);
                if (syncVendorToMaster && extractedVendorData && !vendorId) {
                  await handleCreateExtractedVendor();
                }
                const allowedIndices = Object.entries(linesToSyncMaster)
                  .filter(([, checked]) => checked)
                  .map(([idxStr]) => Number(idxStr));

                save.mutate({ approve: true, syncMasters: true, lineIndicesToSync: allowedIndices });
              }}
              disabled={save.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirm Approval &amp; Sync Masters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TotalRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        step="any"
        className="w-36 text-right"
        value={value}
        onChange={(e) => onChange(toNumber(e.target.value, 0))}
        disabled={disabled}
      />
    </div>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}
