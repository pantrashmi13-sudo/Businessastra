import { createFileRoute } from "@tanstack/react-router";
import PurchaseReturnForm from "@/components/purchases/PurchaseReturnForm";

export const Route = createFileRoute("/purchase-returns/new")({
  component: PurchaseReturnForm,
});
