import { createFileRoute } from "@tanstack/react-router";
import { ChallanList } from "@/components/challans/ChallanList";

export const Route = createFileRoute("/challans/")({
  component: ChallanList,
});
