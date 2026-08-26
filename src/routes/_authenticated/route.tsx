import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Eye } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCanWrite, useMe } from "@/lib/auth";
import { useRealtimeSync } from "@/lib/realtime";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useRealtimeSync();
  const { data: me } = useMe();
  const canWrite = useCanWrite();

  return (
    <>
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
    </>
  );
}
