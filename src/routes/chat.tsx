import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const BASE_SYSTEM_PROMPT = `You are Bizastra AI, an expert business advisor embedded directly inside the Bizastra ERP platform. You have FULL access to the user's live business data (provided below in the context section). When users ask about their vendors, customers, bills, inventory, or any business data, answer using the ACTUAL data provided — never say you don't have access to the database.

Capabilities:
- Answer questions about their real vendors, customers, items, bills, and financial data
- Perform analysis, summaries, and comparisons on the data
- Give accounting advice (journal entries, ledgers, VAT, chart of accounts)
- Help with ERP workflows and business strategy

Rules:
- Always refer to actual data when available
- Be concise, professional, and actionable
- Format tables and structured data clearly
- If data is missing, say the record wasn't found — not that you lack access`;

interface BusinessContext {
  companies: Array<{ name: string; address?: string | null }>;
  vendors: Array<{ name: string; phone?: string | null }>;
  customers: Array<{ name: string; phone?: string | null }>;
  items: Array<{ name: string; unit?: string | null; unit_price?: number | null }>;
  recentBills: Array<{
    bill_number?: string | null;
    invoice_date?: string | null;
    final_amount?: number | null;
    status?: string | null;
    bill_type?: string | null;
    vendors?: { name?: string } | null;
  }>;
  counts: {
    companies: number;
    vendors: number;
    customers: number;
    items: number;
    bills: number;
  };
}

function buildSystemPrompt(ctx: BusinessContext | null): string {
  if (!ctx) return BASE_SYSTEM_PROMPT;

  const lines: string[] = [BASE_SYSTEM_PROMPT, "\n\n---\n## LIVE BUSINESS DATA CONTEXT\n"];

  lines.push(`### Summary Counts\n- Companies: ${ctx.counts.companies}\n- Vendors: ${ctx.counts.vendors}\n- Customers: ${ctx.counts.customers}\n- Inventory Items: ${ctx.counts.items}\n- Total Bills: ${ctx.counts.bills}`);

  if (ctx.companies.length > 0) {
    lines.push(`\n### Companies\n${ctx.companies.map((c) => `- ${c.name}${c.address ? ` (${c.address})` : ""}`).join("\n")}`);
  }
  if (ctx.vendors.length > 0) {
    lines.push(`\n### Vendors (up to 30)\n${ctx.vendors.map((v) => `- ${v.name}${v.phone ? ` | ${v.phone}` : ""}`).join("\n")}`);
  }
  if (ctx.customers.length > 0) {
    lines.push(`\n### Customers (up to 30)\n${ctx.customers.map((c) => `- ${c.name}${c.phone ? ` | ${c.phone}` : ""}`).join("\n")}`);
  }
  if (ctx.items.length > 0) {
    lines.push(`\n### Inventory Items (up to 30)\n${ctx.items.map((i) => `- ${i.name}${i.unit ? ` [${i.unit}]` : ""}${i.unit_price != null ? ` — Price: ${i.unit_price}` : ""}`).join("\n")}`);
  }
  if (ctx.recentBills.length > 0) {
    lines.push(`\n### Recent Bills (last 20)`);
    for (const b of ctx.recentBills) {
      const vendor = (b.vendors as { name?: string } | null)?.name ?? "—";
      lines.push(`- ${b.bill_number ?? "(no #)"} | ${b.bill_type ?? ""} | ${b.invoice_date ?? ""} | ${b.status ?? ""} | Amount: ${b.final_amount ?? 0} | Vendor: ${vendor}`);
    }
  }

  lines.push("\n---");
  return lines.join("\n");
}

function useBusinessContext() {
  const [ctx, setCtx] = useState<BusinessContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const [companies, vendors, customers, items, bills, counts] = await Promise.all([
          supabase.from("companies").select("name, address").limit(10),
          supabase.from("vendors").select("name, phone").limit(30),
          supabase.from("customers").select("name, phone").limit(30),
          supabase.from("items").select("name, unit, unit_price").limit(30),
          supabase
            .from("bills")
            .select("bill_number, invoice_date, final_amount, status, bill_type, vendors(name)")
            .order("created_at", { ascending: false })
            .limit(20),
          Promise.all([
            supabase.from("companies").select("*", { count: "exact", head: true }),
            supabase.from("vendors").select("*", { count: "exact", head: true }),
            supabase.from("customers").select("*", { count: "exact", head: true }),
            supabase.from("items").select("*", { count: "exact", head: true }),
            supabase.from("bills").select("*", { count: "exact", head: true }),
          ]),
        ]);

        if (cancelled) return;

        setCtx({
          companies: (companies.data ?? []) as BusinessContext["companies"],
          vendors: (vendors.data ?? []) as BusinessContext["vendors"],
          customers: (customers.data ?? []) as BusinessContext["customers"],
          items: (items.data ?? []) as BusinessContext["items"],
          recentBills: (bills.data ?? []) as BusinessContext["recentBills"],
          counts: {
            companies: counts[0].count ?? 0,
            vendors: counts[1].count ?? 0,
            customers: counts[2].count ?? 0,
            items: counts[3].count ?? 0,
            bills: counts[4].count ?? 0,
          },
        });
      } catch (e) {
        console.error("Failed to load business context", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  return { ctx, loading };
}

const OPENROUTER_API_KEY: string =
  (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined) ?? "";


const SUGGESTIONS = [
  "How do I record a vendor bill in Bizastra?",
  "Explain double-entry bookkeeping with an example.",
  "What's the difference between accounts payable and accounts receivable?",
  "How should I categorise fixed assets in my chart of accounts?",
  "Walk me through creating a purchase order workflow.",
];

function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-3 transition-colors",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-violet-500 to-purple-700 text-white",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          "relative max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-card border border-border text-foreground",
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        <div
          className={cn(
            "mt-1.5 flex items-center gap-2 text-[10px]",
            isUser ? "justify-start text-primary-foreground/60" : "justify-end text-muted-foreground",
          )}
        >
          <span>
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && (
            <button
              onClick={copyToClipboard}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
              title="Copy response"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-sm">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 shadow-sm">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { ctx, loading: ctxLoading } = useBusinessContext();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);
      setStreamingContent("");

      const apiKey = OPENROUTER_API_KEY;
      if (!apiKey) {
        toast.error("OpenRouter API key is missing. Please add VITE_OPENROUTER_API_KEY to your Vercel Environment Variables and redeploy.");
        setIsLoading(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://bizastra.app",
            "X-Title": "Bizastra ERP Chat",
          },
          body: JSON.stringify({
            model: "openrouter/auto",
            messages: [
              { role: "system", content: buildSystemPrompt(ctx) },
              ...history,
              { role: "user", content: trimmed },
            ],
            stream: true,
            max_tokens: 2048,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error("OpenRouter API error:", res.status, errBody);
          let userMsg = `API error ${res.status}`;
          try {
            const parsed = JSON.parse(errBody) as { error?: { message?: string } };
            if (parsed?.error?.message) userMsg = parsed.error.message;
          } catch { /* ignore */ }
          throw new Error(userMsg);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let full = "";

        if (!reader) throw new Error("No response body");

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") break outer;
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                full += delta;
                setStreamingContent(full);
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: full || "Sorry, I could not generate a response. Please try again.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent("");
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("Chat error:", err);
        toast.error(`Error: ${msg}`);
        setStreamingContent("");
      } finally {
        setIsLoading(false);
        abortRef.current = null;
        textareaRef.current?.focus();
      }
    },
    [isLoading, messages],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    if (isLoading) {
      abortRef.current?.abort();
      setIsLoading(false);
      setStreamingContent("");
    }
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card/60 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">Bizastra AI</h1>
            <p className="text-[11px] text-muted-foreground">
              Your intelligent business advisor
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* DB context status pill */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium border transition-colors",
              ctxLoading
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                : ctx
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                  : "border-red-400/30 bg-red-400/10 text-red-500",
            )}
          >
            {ctxLoading ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Database className="h-2.5 w-2.5" />
            )}
            {ctxLoading ? "Loading data…" : ctx ? "Live data connected" : "No data"}
          </div>

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={clearChat}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Stop
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-lg">
                <MessageSquare className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Ask Bizastra AI</h2>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Get instant help with accounting, ERP workflows, financial analysis, and
                  business strategy.
                </p>
              </div>
            </div>

            <div className="flex w-full max-w-xl flex-col gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="group flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5 text-left text-sm text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-accent hover:shadow-md"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500 group-hover:text-primary transition-colors" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="py-2" ref={scrollRef}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}

              {isLoading && streamingContent && (
                <div className="flex gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-sm">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="relative max-w-[78%] rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 text-sm leading-relaxed shadow-sm text-foreground">
                    <div className="whitespace-pre-wrap break-words">{streamingContent}</div>
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-text-bottom" />
                  </div>
                </div>
              )}

              {isLoading && !streamingContent && <TypingIndicator />}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-card/60 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about accounting, bills, vendors… (Enter to send, Shift+Enter for newline)"
              className="min-h-[44px] max-h-36 resize-none rounded-xl pr-2 text-sm leading-relaxed"
              rows={1}
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
          Powered by Bizastra AI · Responses may not be 100% accurate
        </p>
      </div>
    </div>
  );
}
