import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { QuadrantesVencimentoView } from "@/components/financeiro/QuadrantesVencimentoView";

export const Route = createFileRoute("/_authenticated/financeiro/vencimentos")({
  head: () => ({
    meta: [
      { title: "Vencimentos por Dia | Brasão Financeiro" },
      {
        name: "description",
        content:
          "Visualização diária vertical de contas a pagar e vencimentos por fornecedor em quadrantes tipo planilha Excel.",
      },
      { property: "og:title", content: "Vencimentos por Dia | Brasão Financeiro" },
    ],
  }),
  component: VencimentosPorDiaPage,
});

function VencimentosPorDiaPage() {
  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Vencimentos por Dia"
        description="Painel vertical de vencimentos diários por fornecedor com flexibilidade estilo planilha para reagendamento e controle de fluxo."
      />

      <QuadrantesVencimentoView />
    </div>
  );
}
