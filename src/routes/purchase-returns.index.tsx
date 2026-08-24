import { createFileRoute } from "@tanstack/react-router";
import PurchaseReturnList from "@/components/purchases/PurchaseReturnList";

export const Route = createFileRoute("/purchase-returns/")({
  component: PurchaseReturnList,
});
