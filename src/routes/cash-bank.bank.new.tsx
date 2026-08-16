import { createFileRoute } from "@tanstack/react-router";
import { BankAccountForm } from "@/components/cash-bank/BankAccountForm";

export const Route = createFileRoute("/cash-bank/bank/new")({
  component: () => <BankAccountForm />,
});
