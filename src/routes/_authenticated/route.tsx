import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Eye } from "lucide-react";

import { AppSidebar } from "@/components/AppSidebar";
import { BrasaoLogo } from "@/components/BrasaoLogo";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentAuthUser, useCanWrite, useMe } from "@/lib/auth";
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
  useRealtimeSync();
  const { data: me } = useMe();
  const { branding } = useBranding();
  const canWrite = useCanWrite();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2 min-w-0">
              <BrasaoLogo size="xs" className="shrink-0 md:hidden" />
              <p className="text-sm font-medium text-muted-foreground truncate">
                {branding.companyName || "Galeteria Brasão"} · Gestão Integrada
              </p>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8">
            {me && !canWrite && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                <Eye className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-foreground">
                  <span className="font-medium">Acesso somente leitura.</span>{" "}
                  {me.approved
                    ? "Seu perfil é de visualizador. Peça ao administrador master para liberar edição."
                    : "Sua conta ainda não foi liberada pelo administrador master."}
                </p>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
