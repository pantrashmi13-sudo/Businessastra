import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { inr } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { BsDatePicker } from "@/components/ui/bs-date-picker";
import {
  Landmark,
  PlayCircle,
  Calculator,
  TrendingDown,
  Search,
  RefreshCw,
  Pencil,
} from "lucide-react";
import {
  calculateBulkDepreciation,
  type AssetForDepreciation,
  type DepreciationResult,
} from "@/lib/depreciation";

export const Route = createFileRoute("/fixed-assets-register")({
  component: FixedAssetsRegisterPage,
});

interface FixedAssetRow {
  id: string;
  asset_code: string;
  asset_name: string;
  category: string | null;
  uom: string;
  qty: number;
  purchase_date: string | null;
  purchase_cost: number;
  total_cost: number;
  default_rate: number;
  vat_rate: number;
  depreciation_method: string | null;
  depreciation_rate: number | null;
  useful_life: number | null;
  residual_value: number;
  accumulated_depreciation: number;
  book_value: number;
  last_depreciation_date: string | null;
  is_opening: boolean;
  opening_qty: number;
  opening_wdv: number;
  status: string;
  description: string | null;
  created_at: string;
}

function FixedAssetsRegisterPage() {
  const qc = useQueryClient();
  const dateFormat = useDateFormat();
  const isBS = dateFormat === "bs";
  const [searchQuery, setSearchQuery] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewResults, setPreviewResults] = useState<DepreciationResult[]>([]);
  const [runToDate, setRunToDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Edit dialog state
  const [editingAsset, setEditingAsset] = useState<FixedAssetRow | null>(null);
  const [editForm, setEditForm] = useState({
    depreciation_method: "",
    useful_life: "",
    depreciation_rate: "",
    residual_value: "",
  });

  // Query fixed assets
  const { data: assets, isLoading } = useQuery({
    queryKey: ["fixed-assets-register"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_assets")
        .select("*")
        .order("asset_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FixedAssetRow[];
    },
  });

  // Calculate depreciation preview
  const depreciationPreview = useMemo(() => {
    if (!assets) return [];
    const assetsForCalc: AssetForDepreciation[] = assets.map((a) => ({
      id: a.id,
      asset_code: a.asset_code,
      asset_name: a.asset_name,
      category: a.category,
      purchase_cost: Number(a.purchase_cost || 0),
      total_cost: Number(a.total_cost || 0),
      purchase_date: a.purchase_date,
      depreciation_method: a.depreciation_method,
      useful_life: a.useful_life,
      depreciation_rate: a.depreciation_rate,
      residual_value: Number(a.residual_value || 0),
      accumulated_depreciation: Number(a.accumulated_depreciation || 0),
      book_value: Number(a.book_value || 0) || (Number(a.purchase_cost || 0) + Number(a.total_cost || 0)),
      last_depreciation_date: a.last_depreciation_date,
      status: a.status,
      is_opening: a.is_opening,
      opening_wdv: Number(a.opening_wdv || 0),
    }));
    return calculateBulkDepreciation(assetsForCalc, runToDate);
  }, [assets, runToDate]);

  // Run depreciation mutation
  const runDepreciation = useMutation({
    mutationFn: async (results: DepreciationResult[]) => {
      const updates = results.map((r) =>
        supabase
          .from("fixed_assets")
          .update({
            accumulated_depreciation: r.new_accumulated,
            book_value: r.new_book_value,
            last_depreciation_date: runToDate,
          })
          .eq("id", r.asset_id)
      );
      
      const responses = await Promise.all(updates);
      const errors = responses.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} assets`);
      }
      return results.length;
    },
    onSuccess: (count) => {
      toast.success(`Depreciation updated for ${count} assets`);
      qc.invalidateQueries({ queryKey: ["fixed-assets-register"] });
      setShowPreview(false);
      setPreviewResults([]);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Save asset edit mutation
  const saveAssetEdit = useMutation({
    mutationFn: async () => {
      if (!editingAsset) return;
      // If rate is provided, clear useful_life and vice versa
      const hasRate = editForm.depreciation_rate && Number(editForm.depreciation_rate) > 0;
      const hasLife = editForm.useful_life && Number(editForm.useful_life) > 0;
      
      const updateData: Record<string, unknown> = {
        depreciation_method: editForm.depreciation_method || null,
        residual_value: editForm.residual_value ? Number(editForm.residual_value) : 0,
      };
      
      if (hasRate) {
        updateData.depreciation_rate = Number(editForm.depreciation_rate);
        updateData.useful_life = null; // Clear useful_life when rate is used
      } else if (hasLife) {
        updateData.useful_life = Number(editForm.useful_life);
        updateData.depreciation_rate = null; // Clear rate when useful_life is used
      } else {
        // Neither provided, clear both
        updateData.useful_life = null;
        updateData.depreciation_rate = null;
      }

      const { error } = await supabase
        .from("fixed_assets")
        .update(updateData as any)
        .eq("id", editingAsset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset updated successfully");
      qc.invalidateQueries({ queryKey: ["fixed-assets-register"] });
      setEditingAsset(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Open edit dialog
  const openEditDialog = (asset: FixedAssetRow) => {
    setEditingAsset(asset);
    setEditForm({
      depreciation_method: asset.depreciation_method || "",
      useful_life: asset.useful_life?.toString() || "",
      depreciation_rate: asset.depreciation_rate?.toString() || "",
      residual_value: asset.residual_value?.toString() || "",
    });
  };

  // Filter assets by search
  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        a.asset_code?.toLowerCase().includes(q) ||
        a.asset_name?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q)
    );
  }, [assets, searchQuery]);

  // Summary stats
  const stats = useMemo(() => {
    if (!assets) return { totalLanding: 0, totalAccumulated: 0, totalBookValue: 0, count: 0 };
    return assets.reduce(
      (acc, a) => {
        const landing = Number(a.purchase_cost || 0) + Number(a.total_cost || 0);
        return {
          totalLanding: acc.totalLanding + landing,
          totalAccumulated: acc.totalAccumulated + Number(a.accumulated_depreciation || 0),
          totalBookValue: acc.totalBookValue + (Number(a.book_value || 0) || landing),
          count: acc.count + 1,
        };
      },
      { totalLanding: 0, totalAccumulated: 0, totalBookValue: 0, count: 0 }
    );
  }, [assets]);

  const handlePreviewDepreciation = () => {
    if (!depreciationPreview || depreciationPreview.length === 0) {
      toast.info("No depreciation to run. Assets may be up to date or missing configuration.");
      return;
    }
    setPreviewResults(depreciationPreview);
    setShowPreview(true);
  };

  const handleConfirmRun = () => {
    runDepreciation.mutate(previewResults);
  };

  const getLandingCost = (a: FixedAssetRow) =>
    Number(a.purchase_cost || 0) + Number(a.total_cost || 0);

  const getBookValue = (a: FixedAssetRow) =>
    Number(a.book_value || 0) || getLandingCost(a);

  return (
    <>
      <PageHeader
        title="Asset Master"
        description="Track assets, landing cost, accumulated depreciation, and book value."
      />

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="shadow-sm border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
                <Landmark className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.count}</div>
                <p className="text-xs text-muted-foreground mt-1">Active fixed assets</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Landing Cost</CardTitle>
                <Calculator className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{inr(stats.totalLanding)}</div>
                <p className="text-xs text-muted-foreground mt-1">Purchase cost + other costs</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Accumulated Depreciation</CardTitle>
                <TrendingDown className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-amber-600">{inr(stats.totalAccumulated)}</div>
                <p className="text-xs text-muted-foreground mt-1">Total depreciation charged</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Book Value</CardTitle>
                <Landmark className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-emerald-600">{inr(stats.totalBookValue)}</div>
                <p className="text-xs text-muted-foreground mt-1">Landing cost - Accumulated dep.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Controls */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assets by code, name, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Run Depreciation Till</label>
                {isBS ? (
                  <BsDatePicker
                    value={runToDate}
                    onChange={setRunToDate}
                    className="w-44 h-9"
                  />
                ) : (
                  <Input
                    type="date"
                    className="w-44 h-9"
                    value={runToDate}
                    onChange={(e) => setRunToDate(e.target.value)}
                  />
                )}
              </div>
              <Button
                onClick={handlePreviewDepreciation}
                disabled={isLoading || depreciationPreview.length === 0}
                className="gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                Run Depreciation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assets Table */}
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading assets…</p>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[1300px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[100px]">Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead className="text-right">Landing Cost</TableHead>
                      <TableHead className="text-right">Accum. Depreciation</TableHead>
                      <TableHead className="text-right">Book Value</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Useful Life</TableHead>
                      <TableHead className="text-right">Rate %</TableHead>
                      <TableHead className="text-right">Residual</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="py-8 text-center text-muted-foreground">
                          {searchQuery ? "No assets match your search." : "No assets found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {filteredAssets.map((a) => {
                          const landing = getLandingCost(a);
                          const accum = Number(a.accumulated_depreciation || 0);
                          const book = getBookValue(a);
                          return (
                            <TableRow key={a.id} className="hover:bg-muted/30">
                              <TableCell className="font-mono font-medium text-primary">{a.asset_code}</TableCell>
                              <TableCell>
                                <div className="font-medium">{a.asset_name}</div>
                                {a.is_opening && (
                                  <Badge variant="secondary" className="text-[9px] mt-0.5">Opening</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">{a.category || "—"}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {a.purchase_date ? formatDate(a.purchase_date, dateFormat) : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">{inr(landing)}</TableCell>
                              <TableCell className="text-right font-mono text-amber-600">
                                {accum > 0 ? inr(accum) : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-emerald-600">{inr(book)}</TableCell>
                              <TableCell>
                                <Badge variant={a.depreciation_method ? "default" : "secondary"} className="text-[10px]">
                                  {a.depreciation_method || "Not set"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {a.useful_life ? `${a.useful_life} yrs` : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {a.depreciation_rate ? `${a.depreciation_rate}%` : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {a.residual_value > 0 ? inr(a.residual_value) : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={a.status === "Active" ? "default" : "destructive"}
                                  className="text-[10px]"
                                >
                                  {a.status || "Active"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => openEditDialog(a)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {/* Totals Row */}
                        <TableRow className="bg-muted/50 font-semibold text-sm">
                          <TableCell colSpan={4}>Total ({filteredAssets.length} assets)</TableCell>
                          <TableCell className="text-right font-mono">{inr(stats.totalLanding)}</TableCell>
                          <TableCell className="text-right font-mono text-amber-600">{inr(stats.totalAccumulated)}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-600">{inr(stats.totalBookValue)}</TableCell>
                          <TableCell colSpan={5}></TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Depreciation Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                Depreciation Preview
              </DialogTitle>
              <DialogDescription>
                Review the depreciation calculations before confirming. This will update {previewResults.length} asset(s).
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">Landing Cost</TableHead>
                    <TableHead className="text-right">Prev. Accum.</TableHead>
                    <TableHead className="text-right">Period Dep.</TableHead>
                    <TableHead className="text-right">New Accum.</TableHead>
                    <TableHead className="text-right">New Book Value</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Useful Life</TableHead>
                    <TableHead className="text-right">Rate %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewResults.map((r) => (
                    <TableRow key={r.asset_id}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.asset_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{r.asset_code}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{inr(r.landing_cost)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{inr(r.previous_accumulated)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-600 font-semibold">
                        +{inr(r.period_depreciation)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{inr(r.new_accumulated)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600 font-semibold">
                        {inr(r.new_book_value)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {r.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {r.useful_life ? `${r.useful_life} yrs` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {r.depreciation_rate ? `${r.depreciation_rate}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total ({previewResults.length} assets)</TableCell>
                    <TableCell className="text-right font-mono">
                      {inr(previewResults.reduce((s, r) => s + r.landing_cost, 0))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {inr(previewResults.reduce((s, r) => s + r.previous_accumulated, 0))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-600">
                      +{inr(previewResults.reduce((s, r) => s + r.period_depreciation, 0))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {inr(previewResults.reduce((s, r) => s + r.new_accumulated, 0))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">
                      {inr(previewResults.reduce((s, r) => s + r.new_book_value, 0))}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmRun} disabled={runDepreciation.isPending}>
                {runDepreciation.isPending ? "Updating..." : "Confirm & Update"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Asset Dialog */}
        <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Edit Asset Depreciation
              </DialogTitle>
              <DialogDescription>
                Update depreciation settings for {editingAsset?.asset_name}
              </DialogDescription>
            </DialogHeader>

            {editingAsset && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Asset Code</Label>
                  <div className="font-mono text-sm bg-muted px-3 py-2 rounded">{editingAsset.asset_code}</div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-method">Depreciation Method</Label>
                  <select
                    id="edit-method"
                    className="w-full h-9 border rounded px-3 text-sm bg-background"
                    value={editForm.depreciation_method}
                    onChange={(e) => setEditForm({ ...editForm, depreciation_method: e.target.value })}
                  >
                    <option value="">Not set</option>
                    <option value="Straight Line">Straight Line</option>
                    <option value="Declining Balance">Declining Balance</option>
                  </select>
                </div>

                <div className="bg-muted/50 p-3 rounded text-xs text-muted-foreground">
                  Fill either Useful Life (years) OR Depreciation Rate (%), not both.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-useful-life">Useful Life (Years)</Label>
                    <Input
                      id="edit-useful-life"
                      type="number"
                      min="1"
                      value={editForm.useful_life}
                      onChange={(e) => setEditForm({ ...editForm, useful_life: e.target.value, depreciation_rate: "" })}
                      placeholder="e.g. 5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-rate">OR Depreciation Rate (%)</Label>
                    <Input
                      id="edit-rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={editForm.depreciation_rate}
                      onChange={(e) => setEditForm({ ...editForm, depreciation_rate: e.target.value, useful_life: "" })}
                      placeholder="e.g. 20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-residual">Residual Value</Label>
                  <Input
                    id="edit-residual"
                    type="number"
                    min="0"
                    value={editForm.residual_value}
                    onChange={(e) => setEditForm({ ...editForm, residual_value: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setEditingAsset(null)}>
                Cancel
              </Button>
              <Button onClick={() => saveAssetEdit.mutate()} disabled={saveAssetEdit.isPending}>
                {saveAssetEdit.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
