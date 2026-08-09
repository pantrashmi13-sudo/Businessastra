import { createFileRoute } from "@tanstack/react-router";
import { PaymentVoucherForm } from "@/components/payment-vouchers/PaymentVoucherForm";

export const Route = createFileRoute("/receipt-payment/payment-voucher/new")({
  component: NewPaymentVoucherPage,
});

function NewPaymentVoucherPage() {
  return <PaymentVoucherForm />;
}
