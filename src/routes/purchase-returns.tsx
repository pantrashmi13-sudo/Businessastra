import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/purchase-returns")({
  component: () => <Outlet />,
});
