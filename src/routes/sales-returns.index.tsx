import { createFileRoute } from "@tanstack/react-router";
import SalesReturnList from "@/components/sales/SalesReturnList";

export const Route = createFileRoute("/sales-returns/")({
  component: SalesReturnList,
});
