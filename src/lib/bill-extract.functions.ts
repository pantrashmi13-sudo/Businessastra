import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  file_base64: z.string().min(10),
  mime_type: z.string(),
  bill_type: z.enum(["items", "services", "fixed_assets", "other_items"]),
  bill_id: z.string().optional(),
});

const OutputSchema = z.object({
  vendor_name: z.string().nullable(),
  vendor_vat_number: z.string().nullable(),
  vendor_pan: z.string().nullable(),
  vendor_address: z.string().nullable(),
  vendor_phone: z.string().nullable(),
  vendor_email: z.string().nullable(),
  vendor_state: z.string().nullable(),
  vendor_city: z.string().nullable(),
  vendor_pincode: z.string().nullable(),
  tax_type: z.string().nullable(),
  bill_number: z.string().nullable(),
  invoice_date: z.string().nullable(),
  due_date: z.string().nullable(),
  po_number: z.string().nullable(),
  lines: z.array(
    z.object({
      code: z.string().nullable(),
      name: z.string(),
      uom: z.string().nullable(),
      quantity: z.number(),
      per_unit: z.number(),
      vat_rate: z.number().nullable(),
      lot_number: z.string().nullable(),
      expiry_date: z.string().nullable(),
    }),
  ),
  taxable_amount: z.number().nullable(),
  exempted_amount: z.number().nullable(),
  discount: z.number().nullable(),
  transportation: z.number().nullable(),
  other_charges: z.number().nullable(),
  vat_amount: z.number().nullable(),
  final_amount: z.number().nullable(),
  raw_text: z.string().nullable(),
  validation_errors: z.array(z.string()).nullable(),
});

const serviceUrl = process.env.BILL_OCR_SERVICE_URL || "http://localhost:8001";

// OpenRouter free models with vision support (fallback order)
const OPENROUTER_FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
];

const GEMINI_PROMPT = `
Extract all fields from this invoice/bill and return ONLY valid JSON.
No explanation. No markdown. Raw JSON only.

{
  "vendor_name": "",
  "vendor_vat": "",
  "vendor_pan": "",
  "vendor_address": "",
  "vendor_phone": "",
  "vendor_city": "",
  "vendor_state": "",
  "vendor_pincode": "",
  "bill_number": "",
  "bill_date": "",
  "due_date": "",
  "po_number": "",
  "line_items": [
    {
      "item_name": "",
      "quantity": 0,
      "uom": "NOS",
      "rate": 0,
      "amount": 0,
      "vat_rate": 0,
      "account": ""
    }
  ],
  "subtotal": 0,
  "total_vat": 0,
  "transportation": 0,
  "other_charges": 0,
  "discount": 0,
  "final_amount": 0
}

Rules:
- Numbers must be actual numbers, not strings
- If a field is missing, use null
- Never guess or hallucinate
- bill_date and due_date MUST be in AD (Gregorian) format: YYYY-MM-DD
  If the bill shows BS/Bikram Sambat date, convert it to AD before returning
- uom is unit of measure (NOS, KG, LTR, PCS, BOX, etc.)
- Extract vendor address details if visible on the bill
- Extract PO number if present on the bill
`;

/**
 * Call OpenRouter API with free model fallback
 */
async function extractWithOpenRouter(
  file_base64: string,
  mime_type: string,
): Promise<z.infer<typeof OutputSchema>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set");
  }

  const cleanBase64 = file_base64.includes(",") ? file_base64.split(",")[1] : file_base64;
  const dataUrl = `data:${mime_type};base64,${cleanBase64}`;

  let lastError: Error | null = null;

  for (const model of OPENROUTER_FREE_MODELS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://ledgerly.app",
          "X-Title": "Ledgerly ERP",
        },
        body: JSON.stringify({
          model,
          route: "fallback",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: GEMINI_PROMPT },
                {
                  type: "image_url",
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        lastError = new Error(`OpenRouter API Error (${response.status}): ${errText}`);
        continue;
      }

      const json = await response.json();
      const rawText = json.choices?.[0]?.message?.content ?? "";

      let parsed = {};
      try {
        const cleanedJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanedJson);
      } catch {
        throw new Error("Could not parse JSON output from OpenRouter");
      }

      return mapExtractedToOutput(parsed, rawText);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("All OpenRouter models failed");
}

function mapExtractedToOutput(ex: any, raw_text: string | null): z.infer<typeof OutputSchema> {
  return {
    vendor_name: ex.vendor_name || null,
    vendor_vat_number: ex.vendor_vat || ex.vendor_vat_number || null,
    vendor_pan: ex.vendor_pan || null,
    vendor_address: ex.vendor_address || null,
    vendor_phone: ex.vendor_phone || null,
    vendor_email: ex.vendor_email || null,
    vendor_state: ex.vendor_state || null,
    vendor_city: ex.vendor_city || null,
    vendor_pincode: ex.vendor_pincode || null,
    tax_type: "vat",
    bill_number: ex.bill_number || null,
    invoice_date: ex.bill_date || ex.issue_date || null,
    due_date: ex.due_date || null,
    po_number: ex.po_number || null,
    lines: (ex.line_items || []).map((item: any) => ({
      code: item.account || null,
      name: item.item_name || item.description || "Item",
      uom: item.uom || "NOS",
      quantity: item.quantity || 1,
      per_unit: item.rate || 0,
      vat_rate: item.vat_rate || null,
      lot_number: null,
      expiry_date: null,
    })),
    taxable_amount: ex.subtotal || ex.taxable_amount || null,
    exempted_amount: null,
    discount: ex.discount || null,
    transportation: ex.transportation || null,
    other_charges: ex.other_charges || null,
    vat_amount: ex.total_vat || ex.tax_total || null,
    final_amount: ex.final_amount || ex.total || null,
    raw_text: raw_text || null,
    validation_errors: ex._validation_errors || null,
  };
}

/**
 * Extract bill with fallback chain: Gemini -> OpenRouter (free) -> Python OCR
 */
async function extractWithDirectGemini(
  file_base64: string,
  mime_type: string,
): Promise<z.infer<typeof OutputSchema>> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  // Clean base64 string
  const cleanBase64 = file_base64.includes(",") ? file_base64.split(",")[1] : file_base64;

  // 1. Try Gemini direct (if key exists)
  if (geminiKey) {
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"];
    let lastError: Error | null = null;

    for (const modelName of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: GEMINI_PROMPT },
                    {
                      inline_data: {
                        mime_type: mime_type,
                        data: cleanBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                response_mime_type: "application/json",
                temperature: 0.1,
              },
            }),
          },
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          lastError = new Error(`Gemini API Error (${response.status}): ${errText}`);
          continue;
        }

        const json = await response.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        let parsed = {};
        try {
          const cleanedJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
          parsed = JSON.parse(cleanedJson);
        } catch {
          throw new Error("Could not parse JSON output from Gemini");
        }

        return mapExtractedToOutput(parsed, rawText);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    // If all Gemini models failed, log and continue to OpenRouter
    console.warn("All Gemini models failed, trying OpenRouter:", lastError?.message);
  }

  // 2. Try OpenRouter free models (if key exists)
  if (openrouterKey) {
    try {
      return await extractWithOpenRouter(file_base64, mime_type);
    } catch (err) {
      console.warn("OpenRouter failed, falling back to Python OCR:", (err as Error)?.message);
    }
  }

  // 3. Final fallback: local Python OCR service
  const byteString = atob(cleanBase64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mime_type });

  const ext = mime_type.includes("pdf") ? ".pdf" : mime_type.includes("png") ? ".png" : ".jpg";
  const file = new File([blob], `bill${ext}`, { type: mime_type });

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${serviceUrl}/ocr`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `OCR service error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || "Extraction failed");
  }

  return mapExtractedToOutput(result.extracted, result.raw_text);
}

export const extractBillFromFile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const output = await extractWithDirectGemini(data.file_base64, data.mime_type);
      return output;
    } catch (error) {
      console.error("OCR Extraction error:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Could not extract text") || message.includes("Could not parse JSON")) {
        throw new Error(
          "Couldn't read the bill automatically. Please ensure the image is clear and try again.",
        );
      }
      if (message.includes("503") || message.includes("UNAVAILABLE") || message.includes("busy")) {
        throw new Error("AI service is temporarily busy. Please try again in a few seconds.");
      }
      if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("AI service rate limit reached. Please try again later.");
      }
      throw new Error(`Bill extraction failed: ${message}`);
    }
  });

/**
 * Check health of the OCR service
 */
export async function checkOCRServiceHealth(): Promise<{
  status: string;
  engine: string;
}> {
  if (process.env.GEMINI_API_KEY && process.env.OPENROUTER_API_KEY) {
    return { status: "ok", engine: "gemini+openrouter-fallback" };
  }
  if (process.env.GEMINI_API_KEY) {
    return { status: "ok", engine: "gemini-direct" };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return { status: "ok", engine: "openrouter-free" };
  }
  try {
    const response = await fetch(`${serviceUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { status: "unhealthy", engine: "unknown" };
    }

    return await response.json();
  } catch {
    return { status: "unreachable", engine: "unknown" };
  }
}

