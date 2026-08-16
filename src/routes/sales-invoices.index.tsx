import { createFileRoute } from "@tanstack/react-router";
import { SalesInvoiceList } from "@/components/challans/SalesInvoiceList";

export const Route = createFileRoute("/sales-invoices/")({
  component: SalesInvoiceList,
});
