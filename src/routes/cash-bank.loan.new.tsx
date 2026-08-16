import { createFileRoute } from "@tanstack/react-router";
import { LoanForm } from "@/components/cash-bank/LoanForm";

export const Route = createFileRoute("/cash-bank/loan/new")({
  component: () => <LoanForm />,
});
