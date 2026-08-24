import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronDown,
  ListTree,
  Plus,
  Search,
  Pencil,
  X,
  Check,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/coa")({
  component: CoaPage,
});

type CoaRow = {
  id: string;
  account_code: string;
  classification: string;
  type: string;
  category: string | null;
  sub_category: string | null;
  name: string;
  normal_balance: string;
};

type AccountRow = {
  id: string;
  coa_id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
};

type TreeNode = {
  key: string;
  label: string;
  level: number;
  children: TreeNode[];
  coaRows: CoaRow[];
};

function buildTree(rows: CoaRow[]): TreeNode[] {
  const root: TreeNode[] = [];
  const classMap = new Map<string, TreeNode>();
  const typeMap = new Map<string, TreeNode>();
  const catMap = new Map<string, TreeNode>();
  const subCatMap = new Map<string, TreeNode>();

  for (const row of rows) {
    // Level 1: Classification
    const classKey = row.classification;
    if (!classMap.has(classKey)) {
      const node: TreeNode = {
        key: classKey,
        label: classKey,
        level: 1,
        children: [],
        coaRows: [],
      };
      classMap.set(classKey, node);
      root.push(node);
    }
    const classNode = classMap.get(classKey)!;

    // Level 2: Type
    const typeKey = `${classKey}|${row.type}`;
    if (!typeMap.has(typeKey)) {
      const node: TreeNode = {
        key: typeKey,
        label: row.type,
        level: 2,
        children: [],
        coaRows: [],
      };
      typeMap.set(typeKey, node);
      classNode.children.push(node);
    }
    const typeNode = typeMap.get(typeKey)!;

    // Level 3: Category
    const cat = row.category ?? row.type;
    const catKey = `${typeKey}|${cat}`;
    if (!catMap.has(catKey)) {
      const node: TreeNode = {
        key: catKey,
        label: cat,
        level: 3,
        children: [],
        coaRows: [],
      };
      catMap.set(catKey, node);
      typeNode.children.push(node);
    }
    const catNode = catMap.get(catKey)!;

    // Level 4: Sub-category (Schedule Head)
    const sub = row.sub_category ?? cat;
    const subKey = `${catKey}|${sub}`;
    if (!subCatMap.has(subKey)) {
      const node: TreeNode = {
        key: subKey,
        label: sub,
        level: 4,
        children: [],
        coaRows: [],
      };
      subCatMap.set(subKey, node);
      catNode.children.push(node);
    }
    const subNode = subCatMap.get(subKey)!;
    subNode.coaRows.push(row);
  }

  return root;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  Assets: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Liabilities: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  PL: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Equity: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const LEVEL_INDENT = ["pl-0", "pl-5", "pl-10", "pl-16", "pl-24"];
const LEVEL_TEXT = [
  "text-sm font-bold text-foreground",
  "text-sm font-semibold text-foreground/90",
  "text-sm font-medium text-foreground/80",
  "text-xs font-medium text-muted-foreground",
  "text-xs text-muted-foreground/70",
];

function TreeNodeRow({
  node,
  accounts,
  onAddAccount,
  onAddScheduleHead,
  onToggleAccount,
  search,
}: {
  node: TreeNode;
  accounts: AccountRow[];
  onAddAccount: (coa: CoaRow) => void;
  onAddScheduleHead: (parent: ScheduleHeadParent) => void;
  onToggleAccount: (acc: AccountRow) => void;
  search: string;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const coaRows = node.coaRows;

  const filteredCoa = useMemo(() => {
    if (!search) return coaRows;
    const q = search.toLowerCase();
    return coaRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.account_code.includes(q) ||
        r.sub_category?.toLowerCase().includes(q)
    );
  }, [coaRows, search]);

  const indent = LEVEL_INDENT[node.level - 1] ?? "pl-24";
  const textClass = LEVEL_TEXT[node.level - 1] ?? LEVEL_TEXT[4];

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 w-full text-left py-1.5 px-2 rounded hover:bg-muted/40 transition-colors group ${indent}`}
      >
        {hasChildren || coaRows.length > 0 ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <span className={textClass}>{node.label}</span>
        {node.level === 1 && (
          <Badge
            variant="outline"
            className={`ml-auto text-[10px] px-1.5 py-0 h-4 ${CLASSIFICATION_COLORS[node.label] ?? ""}`}
          >
            {node.label}
          </Badge>
        )}
        {node.level === 3 && (
          <button
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              const parts = node.key.split("|");
              onAddScheduleHead({
                classification: parts[0] ?? "",
                type: parts[1] ?? "",
                category: node.label,
              });
            }}
          >
            <Plus className="h-3 w-3" />
            Add Schedule Head
          </button>
        )}
      </button>

      {open && (
        <div>
          {/* Render children nodes */}
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.key}
              node={child}
              accounts={accounts}
              onAddAccount={onAddAccount}
              onAddScheduleHead={onAddScheduleHead}
              onToggleAccount={onToggleAccount}
              search={search}
            />
          ))}

          {/* Render COA rows (level 5 - schedule head level) */}
          {filteredCoa.map((coa) => {
            const coaAccounts = accounts.filter((a) => a.coa_id === coa.id);
            return (
              <CoaScheduleRow
                key={coa.id}
                coa={coa}
                accounts={coaAccounts}
                onAddAccount={onAddAccount}
                onToggleAccount={onToggleAccount}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function CoaScheduleRow({
  coa,
  accounts,
  onAddAccount,
  onToggleAccount,
}: {
  coa: CoaRow;
  accounts: AccountRow[];
  onAddAccount: (coa: CoaRow) => void;
  onToggleAccount: (acc: AccountRow) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full text-left py-1.5 px-2 rounded hover:bg-muted/40 transition-colors group pl-24"
      >
        {accounts.length > 0 ? (
          open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="text-xs font-medium text-foreground">{coa.name}</span>
        <span className="ml-1 text-[10px] text-muted-foreground/60">
          [{coa.account_code}]
        </span>
        <Badge
          variant="outline"
          className="ml-1 text-[10px] px-1 py-0 h-4 font-normal"
        >
          {coa.normal_balance}
        </Badge>
        {accounts.length > 0 && (
          <span className="ml-1 text-[10px] text-muted-foreground/50">
            {accounts.length} acct{accounts.length > 1 ? "s" : ""}
          </span>
        )}
        <button
          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onAddAccount(coa);
          }}
        >
          <Plus className="h-3 w-3" />
          Add Account
        </button>
      </button>

      {open && accounts.length > 0 && (
        <div className="pl-32 border-l border-border/50 ml-28 my-0.5">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center gap-2 py-1 px-2 hover:bg-muted/30 rounded group/acc"
            >
              <div
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${acc.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
              />
              <span
                className={`text-xs ${acc.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}
              >
                {acc.name}
              </span>
              {acc.code && (
                <span className="text-[10px] text-muted-foreground/60">
                  [{acc.code}]
                </span>
              )}
              {!acc.is_active && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 h-4"
                >
                  Inactive
                </Badge>
              )}
              <button
                className="ml-auto opacity-0 group-hover/acc:opacity-100 transition-opacity"
                title={acc.is_active ? "Deactivate" : "Activate"}
                onClick={() => onToggleAccount(acc)}
              >
                {acc.is_active ? (
                  <Ban className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                ) : (
                  <Check className="h-3 w-3 text-muted-foreground hover:text-emerald-500" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddAccountDialog({
  open,
  coa,
  onClose,
}: {
  open: boolean;
  coa: CoaRow | null;
  onClose: () => void;
}) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!company?.id || !coa) throw new Error("Missing company or COA");
      const { error } = await supabase.from("accounts").insert({
        company_id: company.id,
        coa_id: coa.id,
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account created successfully");
      qc.invalidateQueries({ queryKey: ["accounts", company?.id] });
      setName("");
      setCode("");
      setDescription("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
        </DialogHeader>
        {coa && (
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-0.5 mb-2">
            <div>
              <span className="font-medium text-foreground">Schedule Head:</span>{" "}
              {coa.name}
            </div>
            <div>
              <span className="font-medium">Code:</span> {coa.account_code}
            </div>
            <div>
              <span className="font-medium">Category:</span>{" "}
              {coa.classification} → {coa.type} → {coa.category} →{" "}
              {coa.sub_category}
            </div>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label htmlFor="acc-name">Account Name *</Label>
            <Input
              id="acc-name"
              placeholder="e.g. ABC Pvt. Ltd."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="acc-code">Account Code (optional)</Label>
            <Input
              id="acc-code"
              placeholder="e.g. TR-001"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="acc-desc">Description (optional)</Label>
            <Textarea
              id="acc-desc"
              rows={2}
              placeholder="Notes about this account..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ScheduleHeadParent = {
  classification: string;
  type: string;
  category: string;
};

function AddScheduleHeadDialog({
  open,
  parent,
  onClose,
}: {
  open: boolean;
  parent: ScheduleHeadParent | null;
  onClose: () => void;
}) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [normalBalance, setNormalBalance] = useState<"Debit" | "Credit">("Debit");

  const classificationOptions = ["Assets", "Liabilities", "PL", "Equity"];
  const typeOptions: Record<string, string[]> = {
    Assets: ["Current Assets", "Non-Current Assets"],
    Liabilities: ["Current Liabilities", "Non-Current Liabilities", "Equity"],
    PL: ["Revenue from Operations", "Other Income", "Operating Expenses", "Depreciation and Amortization Expense", "Finance Costs"],
    Equity: ["Share Capital", "Other Equity"],
  };
  const categoryOptions: Record<string, string[]> = {
    "Revenue from Operations": ["Revenue from Operations"],
    "Other Income": ["Other Income"],
    "Operating Expenses": ["Administrative Expenses", "Cost of Sales", "Selling and Distribution Expenses"],
    "Depreciation and Amortization Expense": ["Depreciation and Amortization Expense"],
    "Finance Costs": ["Finance Costs"],
    "Current Assets": ["Current Tax Assets", "Financial Assets", "Inventories", "Other Current Assets"],
    "Non-Current Assets": ["Deferred Tax Assets", "Intangible assets", "Property, Plant and Equipment"],
    "Current Liabilities": ["Financial Liabilities", "Other current liabilities"],
    "Non-Current Liabilities": ["Deferred tax liabilities", "Financial Liabilities"],
    Equity: ["Other Equity", "Share Capital"],
  };

  const [classification, setClassification] = useState(parent?.classification ?? "PL");
  const [type, setType] = useState(parent?.type ?? "Revenue from Operations");
  const [category, setCategory] = useState(parent?.category ?? "Revenue from Operations");

  const resetForm = () => {
    setName("");
    setCode("");
    setNormalBalance("Debit");
    setClassification(parent?.classification ?? "PL");
    setType(parent?.type ?? "Revenue from Operations");
    setCategory(parent?.category ?? "Revenue from Operations");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error("Missing company");
      const nextCode = code.trim() || `COA-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("chart_of_accounts").insert({
        company_id: company.id,
        account_code: nextCode,
        classification,
        type,
        category,
        sub_category: name.trim(),
        name: name.trim(),
        normal_balance: normalBalance,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule Head created successfully");
      qc.invalidateQueries({ queryKey: ["chart_of_accounts", company?.id] });
      resetForm();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Schedule Head</DialogTitle>
        </DialogHeader>
        {parent && (
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-0.5 mb-2">
            <div>
              <span className="font-medium text-foreground">Category:</span>{" "}
              {parent.classification} → {parent.type} → {parent.category}
            </div>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label htmlFor="sh-classification">Classification *</Label>
            <Select
              value={classification}
              onValueChange={(v) => {
                setClassification(v);
                const types = typeOptions[v] ?? [];
                if (types.length > 0) {
                  setType(types[0]);
                  const cats = categoryOptions[types[0]] ?? [];
                  if (cats.length > 0) setCategory(cats[0]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classificationOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="sh-type">Type *</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                const cats = categoryOptions[v] ?? [];
                if (cats.length > 0) setCategory(cats[0]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(typeOptions[classification] ?? []).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="sh-category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(categoryOptions[type] ?? []).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="sh-name">Schedule Head Name *</Label>
            <Input
              id="sh-name"
              placeholder="e.g. Sales"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sh-code">Account Code (optional)</Label>
            <Input
              id="sh-code"
              placeholder="e.g. 4001"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <Label>Normal Balance *</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={normalBalance === "Debit" ? "default" : "outline"}
                size="sm"
                onClick={() => setNormalBalance("Debit")}
              >
                Debit
              </Button>
              <Button
                type="button"
                variant={normalBalance === "Credit" ? "default" : "outline"}
                size="sm"
                onClick={() => setNormalBalance("Credit")}
              >
                Credit
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Create Schedule Head"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CoaPage() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogCoa, setDialogCoa] = useState<CoaRow | null>(null);
  const [dialogScheduleHeadParent, setDialogScheduleHeadParent] = useState<ScheduleHeadParent | null>(null);

  const { data: coas = [], isLoading: coaLoading } = useQuery<CoaRow[]>({
    queryKey: ["chart_of_accounts", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", company!.id)
        .order("account_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: accounts = [] } = useQuery<AccountRow[]>({
    queryKey: ["accounts", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, coa_id, name, code, description, is_active")
        .eq("company_id", company!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleAccount = useMutation({
    mutationFn: async (acc: AccountRow) => {
      const { error } = await supabase
        .from("accounts")
        .update({ is_active: !acc.is_active })
        .eq("id", acc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account status updated");
      qc.invalidateQueries({ queryKey: ["accounts", company?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredCoas = useMemo(() => {
    if (!search) return coas;
    const q = search.toLowerCase();
    return coas.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.account_code.includes(q) ||
        c.type.toLowerCase().includes(q) ||
        c.classification.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.sub_category?.toLowerCase().includes(q)
    );
  }, [coas, search]);

  const tree = useMemo(() => buildTree(filteredCoas), [filteredCoas]);
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.is_active).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ListTree className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Chart of Accounts</h1>
          <p className="text-xs text-muted-foreground">
            {totalAccounts} accounts · {activeAccounts} active
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search accounts, codes, categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* COA Tree */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {/* Legend */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/20 rounded-t-xl">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Account Hierarchy
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {Object.entries(CLASSIFICATION_COLORS).map(([k, v]) => (
              <Badge
                key={k}
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-4 ${v}`}
              >
                {k}
              </Badge>
            ))}
          </div>
        </div>

        <div className="p-3">
          {coaLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading chart of accounts...
            </div>
          ) : tree.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search ? "No matching accounts found." : "No chart of accounts found."}
            </div>
          ) : (
            tree.map((node) => (
              <TreeNodeRow
                key={node.key}
                node={node}
                accounts={accounts}
                onAddAccount={setDialogCoa}
                onAddScheduleHead={setDialogScheduleHeadParent}
                onToggleAccount={(acc) => toggleAccount.mutate(acc)}
                search={search}
              />
            ))
          )}
        </div>
      </div>

      <AddAccountDialog
        open={!!dialogCoa}
        coa={dialogCoa}
        onClose={() => setDialogCoa(null)}
      />

      <AddScheduleHeadDialog
        open={!!dialogScheduleHeadParent}
        parent={dialogScheduleHeadParent}
        onClose={() => setDialogScheduleHeadParent(null)}
      />
    </div>
  );
}
