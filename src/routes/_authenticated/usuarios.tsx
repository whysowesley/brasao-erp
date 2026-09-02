import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { UserApprovalCard } from "@/components/UserApprovalCard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e Permissões | Brasão" },
      {
        name: "description",
        content:
          "Aprove novas contas criadas e defina o nível de acesso Master de cada usuário no sistema Brasão.",
      },
      { property: "og:title", content: "Usuários e Permissões | Brasão" },
      {
        property: "og:description",
        content: "Controle de aprovação de novos cadastros e permissões de acesso ao sistema.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { isMaster } = useAuth();

  if (!isMaster) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-lg font-semibold">Acesso Restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas o administrador master pode aprovar e gerenciar usuários do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Usuários e Permissões"
        description="Aprove novos cadastros de usuários e gerencie o acesso master ao sistema."
      />

      <UserApprovalCard />
    </div>
  );
}
