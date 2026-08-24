import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/masters/MasterCrudPage";
import { fixedAssetSchema, fixedAssetFields } from "@/components/masters/schemas";
import { useDateFormat } from "@/hooks/use-date-format";
import { formatDate } from "@/lib/date-conversion";

function FixedAssetsPage() {
  const dateFormat = useDateFormat();

  return (
    <MasterCrudPage
      title="Asset Master"
      description="Manage fixed assets with depreciation tracking."
      table="fixed_assets"
      schema={fixedAssetSchema}
      fields={fixedAssetFields}
      searchKeys={["asset_code", "asset_name", "category"]}
      columns={[
        { key: "asset_code", label: "Code" },
        { key: "asset_name", label: "Name" },
        { key: "category", label: "Category" },
        { key: "qty", label: "Qty" },
        { key: "uom", label: "Unit" },
        { key: "purchase_date", label: "Purchase Date", render: (v) => formatDate(v as string, dateFormat) },
        { key: "purchase_cost", label: "Purchase Cost" },
        { key: "total_cost", label: "Total Cost" },
        { key: "depreciation_method", label: "Depreciation" },
        { key: "useful_life", label: "Useful Life", render: (v) => v ? `${v} yrs` : "—" },
        { key: "residual_value", label: "Residual Value" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}

export const Route = createFileRoute("/masters/fixed-assets")({
  component: FixedAssetsPage,
});
