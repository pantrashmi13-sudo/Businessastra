import { createFileRoute } from "@tanstack/react-router";
import { ReceiptVoucherForm } from "@/components/receipt-vouchers/ReceiptVoucherForm";

export const Route = createFileRoute("/receipt-payment/receipt-voucher/new")({
  component: () => <ReceiptVoucherForm />,
});
