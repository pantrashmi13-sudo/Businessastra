import { createFileRoute } from "@tanstack/react-router";
import { ChallanForm } from "@/components/challans/ChallanForm";

export const Route = createFileRoute("/challans/new")({
  component: () => <ChallanForm />,
});
