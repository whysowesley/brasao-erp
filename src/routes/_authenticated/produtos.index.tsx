import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/produtos/")({
  beforeLoad: () => {
    throw redirect({ to: "/estoque", replace: true });
  },
  component: () => null,
});
