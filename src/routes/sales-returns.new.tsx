import { createFileRoute } from "@tanstack/react-router";
import SalesReturnForm from "@/components/sales/SalesReturnForm";

export const Route = createFileRoute("/sales-returns/new")({
  component: SalesReturnForm,
});
