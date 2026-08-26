import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "master" | "editor" | "viewer";

export type Me = {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  approved: boolean;
  role: AppRole;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: 30_000,
    queryFn: async (): Promise<Me | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name, avatar_url, approved")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      const roleList = (roles ?? []).map((r) => r.role as AppRole);
      const role: AppRole = roleList.includes("master")
        ? "master"
        : roleList.includes("editor")
          ? "editor"
          : "viewer";

      return {
        userId: user.id,
        email: profile?.email ?? user.email ?? "",
        fullName: profile?.full_name ?? user.email ?? "",
        avatarUrl: profile?.avatar_url ?? null,
        approved: Boolean(profile?.approved),
        role,
      };
    },
  });
}

/** Pode criar, editar e excluir dados do sistema. */
export function useCanWrite() {
  const { data: me } = useMe();
  return Boolean(me?.approved && (me.role === "master" || me.role === "editor"));
}

export function useIsMaster() {
  const { data: me } = useMe();
  return me?.role === "master";
}

export const ROLE_LABEL: Record<AppRole, string> = {
  master: "Administrador master",
  editor: "Editor",
  viewer: "Visualizador",
};
