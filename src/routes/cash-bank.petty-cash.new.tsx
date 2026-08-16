import { createFileRoute } from "@tanstack/react-router";
import { PettyCashForm } from "@/components/cash-bank/PettyCashForm";

export const Route = createFileRoute("/cash-bank/petty-cash/new")({
  component: () => <PettyCashForm />,
});
