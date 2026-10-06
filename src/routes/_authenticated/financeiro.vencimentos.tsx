import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/financeiro/vencimentos")({
  beforeLoad: () => {
    throw redirect({ to: "/financeiro/contas-pagar" });
  },
  component: () => null,
});
