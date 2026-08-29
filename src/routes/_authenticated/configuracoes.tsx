import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/PageHeader";
import { BrandingSettingsCard } from "@/components/BrandingSettingsCard";
import { useCategories, useProducts, useSuppliers } from "@/lib/data";
import { useAuth, ROLE_LABEL } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Brasão" },
      {
        name: "description",
        content:
          "Configurações gerais do sistema: Identidade Visual / Branding da empresa, perfil de usuário, regras de cálculo de estoque e estatísticas.",
      },
      { property: "og:title", content: "Configurações | Brasão" },
      {
        property: "og:description",
        content: "Identidade visual, regras de cálculo e parâmetros do sistema.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { data: products } = useProducts();
  const { data: suppliers } = useSuppliers();
  const { data: categories } = useCategories();
  const { userProfile, role, isMaster } = useAuth();

  const stats = [
    { label: "Produtos cadastrados", value: products?.length ?? 0 },
    { label: "Fornecedores", value: suppliers?.length ?? 0 },
    { label: "Categorias", value: categories?.length ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Configurações do Sistema"
        description="Gerencie a identidade visual, veja parâmetros de estoque e informações de acesso."
      />

      {/* Seção 1: Identidade Visual e Branding */}
      <BrandingSettingsCard />

      {/* Seção 2: Estatísticas Rápidas de Cadastro */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="num mt-1 text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Seção 3: Usuário Logado & Permissões */}
      <section className="rounded-lg border bg-card p-5 shadow-card">
        <h2 className="text-sm font-semibold">Sessão e Permissões</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Usuário Ativo</p>
            <p className="font-semibold text-foreground mt-0.5">
              {userProfile?.fullName || "Administrador"}
            </p>
            <p className="text-xs text-muted-foreground">{userProfile?.email || "Sem e-mail"}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Nível de Acesso</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-semibold text-foreground">{ROLE_LABEL[role] || role}</span>
              {isMaster && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Master
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isMaster
                ? "Acesso irrestrito a todos os módulos e configurações."
                : "Permissões configuradas pelo administrador master."}
            </p>
          </div>
        </div>
      </section>

      {/* Seção 4: Regras de Cálculo */}
      <section className="rounded-lg border bg-card p-5 shadow-card">
        <h2 className="text-sm font-semibold">Regras de Cálculo de Estoque</h2>
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
