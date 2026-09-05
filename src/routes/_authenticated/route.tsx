import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Clock, Eye, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/AppSidebar";
import { BrasaoLogo } from "@/components/BrasaoLogo";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentAuthUser, signOutAuth, useAuth, useCanWrite, useMe } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { useRealtimeSync } from "@/lib/realtime";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const user = await getCurrentAuthUser();
    if (!user) throw redirect({ to: "/auth" });
    return { userId: user.uid, userEmail: user.email || "" };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: me, isLoading, refetch } = useMe();
  const { isApproved, isMaster, signOut } = useAuth();
  const { branding } = useBranding();
  const canWrite = useCanWrite();

  // Só ativa a sincronização em tempo real se o usuário já estiver aprovado
  useRealtimeSync();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Verificando autorização de acesso...</p>
        </div>
      </div>
    );
  }

  // Se o usuário estiver autenticado porém não aprovado pelo master:
  if (me && !isApproved && !isMaster) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-card sm:p-8">
          <BrasaoLogo size="hero" customSrc="/brasao-logo.jpeg" className="mx-auto mb-4" />

          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Clock className="h-6 w-6" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Aguardando Aprovação do Administrador
          </h1>

          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Conta Registrada · Acesso Pendente
          </p>

          <div className="mt-5 rounded-lg border border-amber-500/25 bg-amber-50/60 p-4 text-left text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-semibold">
              Usuário: <span className="font-mono text-foreground">{me.email}</span>
            </p>
            <p className="mt-1 text-muted-foreground">
              Nome: <span className="font-medium text-foreground">{me.fullName}</span>
            </p>
            <hr className="my-2.5 border-amber-500/20" />
            <p className="leading-relaxed">
              Para proteger os dados e a operação da{" "}
              <strong>{branding.companyName || "Galeteria Brasão"}</strong>, o acesso total ao
              sistema requer que o administrador master (<strong>Wesley</strong>) aprove seu
              cadastro na seção de <strong>Configurações &gt; Usuários</strong>.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              type="button"
              className="w-full gap-2"
              onClick={async () => {
                const res = await refetch();
                if (res.data?.approved) {
                  toast.success("Acesso liberado! Seja bem-vindo ao sistema.");
                } else {
                  toast.info("Seu cadastro ainda está aguardando aprovação nas Configurações.");
                }
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Verificar se Fui Aprovado
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 text-xs"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
              Sair da Conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-3 sm:px-4 backdrop-blur">
            <SidebarTrigger className="h-9 w-9 touch-manipulation" />
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2 min-w-0">
              <BrasaoLogo size="xs" className="shrink-0 md:hidden" />
              <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                {branding.companyName || "Galeteria Brasão"} · Gestão Integrada
              </p>
            </div>
          </header>
          <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 md:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
