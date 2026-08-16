import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ConsumptionForm } from "@/components/consumptions/ConsumptionForm";

export const Route = createFileRoute("/consumptions/$id")({
  component: ConsumptionDetail,
});

function ConsumptionDetail() {
  const { id } = Route.useParams();

  const consumption = useQuery({
    queryKey: ["consumption", id],
    queryFn: async () => {
      const { data: consumption, error } = await supabase
        .from("consumptions")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;

      const { data: lines } = await supabase
        .from("consumption_lines")
        .select("*")
        .eq("consumption_id", id)
        .order("sno");

      return { consumption, lines: lines ?? [] };
    },
  });

  if (consumption.isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (consumption.error) return <div className="p-6 text-destructive">Error loading consumption.</div>;

  return (
    <ConsumptionForm
      consumptionId={id}
      initial={consumption.data}
    />
  );
}
