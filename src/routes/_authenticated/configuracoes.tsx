import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/PageHeader";
import { CURRENT_USER, useCategories, useProducts, useSuppliers } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Brasão" },
      {
        name: "description",
        content:
          "Informações do sistema interno de controle de estoque e compras da Brasão: usuário, regras de cálculo e totais cadastrados.",
      },
      { property: "og:title", content: "Configurações | Brasão" },
      {
        property: "og:description",
        content: "Usuário atual, regras de cálculo e resumo do cadastro.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { data: products } = useProducts();
  const { data: suppliers } = useSuppliers();
  const { data: categories } = useCategories();

  const stats = [
    { label: "Produtos cadastrados", value: products?.length ?? 0 },
    { label: "Fornecedores", value: suppliers?.length ?? 0 },
    { label: "Categorias", value: categories?.length ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Configurações" description="Informações e regras do sistema." />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="num mt-1 text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-lg border bg-card p-5 shadow-card">
        <h2 className="text-sm font-semibold">Usuário atual</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as movimentações são registradas em nome de <strong>{CURRENT_USER}</strong>.
        </p>
      </section>

      <section className="mt-4 rounded-lg border bg-card p-5 shadow-card">
        <h2 className="text-sm font-semibold">Regras de cálculo</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Compra sugerida</strong> = Estoque desejado −
            Estoque atual + Consumo semanal (nunca negativa).
          </li>
          <li>
            <strong className="text-foreground">Estoque futuro</strong> = Estoque atual + Compra
            sugerida − Consumo semanal.
          </li>
          <li>
            <strong className="text-critical">Crítico</strong>: estoque abaixo do consumo semanal ·{" "}
            <strong className="text-warning">Atenção</strong>: estoque próximo do mínimo ·{" "}
            <strong className="text-success">Normal</strong>: estoque suficiente.
          </li>
        </ul>
      </section>
    </div>
  );
}
