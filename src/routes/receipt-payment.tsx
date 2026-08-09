import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/receipt-payment")({
  component: ReceiptPaymentLayout,
});

function ReceiptPaymentLayout() {
  return <Outlet />;
}
