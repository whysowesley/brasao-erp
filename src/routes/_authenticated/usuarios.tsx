import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ROLE_LABEL,
  fetchUsersList,
  setUserApproval,
  setUserRole,
  useMe,
  type AppRole,
  type UserProfileRow,
} from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e permissões | Brasão" },
      {
        name: "description",
        content:
          "Aprove novas contas e defina o nível de acesso de cada pessoa no sistema da Brasão.",
      },
      { property: "og:title", content: "Usuários e permissões | Brasão" },
      {
        property: "og:description",
        content: "Controle de contas aprovadas e níveis de acesso do sistema interno.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    enabled: me?.role === "master",
    queryFn: fetchUsersList,
  });

  const setApproved = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      await setUserApproval(id, approved);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Acesso atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppRole }) => {
      await setUserRole(id, role);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Nível de acesso atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (me && me.role !== "master") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas o administrador master pode gerenciar usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Usuários e permissões"
        description="Aprove o acesso e defina o que cada pessoa pode fazer no sistema."
      />

      <div className="rounded-lg border bg-card shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Nível de acesso</TableHead>
                <TableHead className="text-center">Aprovado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium">{u.full_name ?? u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(role) => setRole.mutate({ id: u.id, role: role as AppRole })}
                      disabled={u.id === me?.userId}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">{ROLE_LABEL.viewer}</SelectItem>
                        <SelectItem value="editor">{ROLE_LABEL.editor}</SelectItem>
                        <SelectItem value="master">{ROLE_LABEL.master}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={u.approved}
                      disabled={u.id === me?.userId}
                      onCheckedChange={(approved) => setApproved.mutate({ id: u.id, approved })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {u.role === "master" ? (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3 w-3" /> Master
                      </Badge>
                    ) : u.approved ? (
                      <Badge variant="outline">Ativo</Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setApproved.mutate({ id: u.id, approved: true })}
                      >
                        Liberar acesso
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (users?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhum usuário cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Visualizador: só consulta os dados. Editor: pode lançar estoque, contagens e pedidos.
        Administrador master: acesso total, incluindo gestão de usuários.
      </p>
    </div>
  );
}
