import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/sales-returns")({
  component: () => <Outlet />,
});
