import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/cash-bank")({
  component: () => <Outlet />,
});
