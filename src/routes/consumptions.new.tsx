import { createFileRoute } from "@tanstack/react-router";
import { ConsumptionForm } from "@/components/consumptions/ConsumptionForm";

export const Route = createFileRoute("/consumptions/new")({
  component: NewConsumption,
});

function NewConsumption() {
  return <ConsumptionForm />;
}
