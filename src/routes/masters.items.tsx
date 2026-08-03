import { createFileRoute } from "@tanstack/react-router";
import { MaterialCentreRegister } from "@/components/masters/MaterialCentreRegister";

export const Route = createFileRoute("/masters/items")({
  component: MaterialCentreRegister,
  validateSearch: (search: Record<string, unknown>) => ({
    returnBillId: (search.returnBillId as string) || undefined,
  }),
});
