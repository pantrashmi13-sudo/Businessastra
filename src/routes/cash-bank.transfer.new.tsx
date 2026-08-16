import { createFileRoute } from "@tanstack/react-router";
import { TransferForm } from "@/components/cash-bank/TransferForm";

export const Route = createFileRoute("/cash-bank/transfer/new")({
  component: () => <TransferForm />,
});
