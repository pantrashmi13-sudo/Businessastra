import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChallanForm } from "@/components/challans/ChallanForm";

export const Route = createFileRoute("/challans/$id")({
  component: ChallanDetailRoute,
});

function ChallanDetailRoute() {
  const { id } = Route.useParams();

  const challanQuery = useQuery({
    queryKey: ["delivery_challans", id],
    queryFn: async () => {
      const { data: challan, error: cErr } = await supabase
        .from("delivery_challans" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (cErr) throw cErr;

      const { data: lines, error: lErr } = await supabase
        .from("delivery_challan_lines" as any)
        .select("*")
        .eq("challan_id", id)
        .order("sno", { ascending: true });
      if (lErr) throw lErr;

      return { challan: (challan as unknown as Record<string, unknown> | null), lines: (lines as any[]) ?? [] };
    },
  });

  if (challanQuery.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading Delivery Challan #{id}…</div>;
  }

  if (challanQuery.error || !challanQuery.data) {
    return (
      <div className="p-8 text-center text-destructive">
        Failed to load Delivery Challan. {(challanQuery.error as Error)?.message}
      </div>
    );
  }

  return <ChallanForm challanId={id} initial={challanQuery.data} />;
}
