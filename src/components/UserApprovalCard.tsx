import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  deleteUserProfile,
  fetchUsersList,
  setUserApproval,
  setUserRole,
  useMe,
  type AppRole,
  type UserProfileRow,
} from "@/lib/auth";

export function UserApprovalCard() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: users = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["users_list"],
    queryFn: fetchUsersList,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      await setUserApproval(id, approved);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["users_list"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      if (variables.approved) {
        toast.success("Usuário aprovado com acesso de Gerente.");
      } else {
        toast.info("Acesso do usuário revogado.");
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar acesso: ${err.message}`);
    },
  });

  const setRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppRole }) => {
      await setUserRole(id, role);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users_list"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Nível de acesso atualizado.");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar nível: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteUserProfile(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users_list"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Solicitação/usuário removido do sistema.");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover usuário: ${err.message}`);
    },
  });

  const pendingUsers = users.filter((u) => !u.approved);
  const activeUsers = users.filter((u) => u.approved);

  const filteredActiveUsers = activeUsers.filter(
    (u) =>
      (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header do Bloco de Usuários */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Aprovação e Gerenciamento de Usuários
            </h2>
            <p className="text-xs text-muted-foreground">
              Aprove novos cadastros e controle o nível de acesso de cada usuário.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar Lista
        </Button>
      </div>

      {/* SEÇÃO 1: SOLICITAÇÕES PENDENTES DE APROVAÇÃO */}
      {pendingUsers.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {pendingUsers.length} Nova{pendingUsers.length > 1 ? "s" : ""} Solicitaç
                {pendingUsers.length > 1 ? "ões" : "ão"} de Cadastro Aguardando Aprovação
              </h3>
            </div>
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-700 dark:text-amber-300"
            >
              Pendente
            </Badge>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Estes usuários criaram conta com e-mail e senha, mas ainda não possuem acesso até você
            aprovar:
          </p>

          <div className="mt-3 space-y-2.5">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-card p-3.5 shadow-2xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {u.full_name || "Sem Nome Informado"}
                    </span>
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                      Aguardando Liberação
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Cadastrado em: {new Date(u.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ id: u.id, approved: true })}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Aprovar Acesso
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `Deseja rejeitar e remover a solicitação do usuário ${u.full_name || u.email}?`,
                        )
                      ) {
                        deleteMutation.mutate(u.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="h-4 w-4" />
          </div>
          <p className="mt-1.5 text-xs font-medium text-foreground">
            Nenhuma solicitação pendente de aprovação
          </p>
          <p className="text-[11px] text-muted-foreground">
            Quando alguém criar uma nova conta na tela de entrada, ela aparecerá aqui para sua
            liberação.
          </p>
        </div>
      )}

      {/* SEÇÃO 2: USUÁRIOS ATIVOS E APROVADOS */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Usuários com Acesso Liberado ({activeUsers.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Usuários que já podem acessar o sistema conforme o papel definido.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              className="pl-8 text-xs h-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Nível de Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActiveUsers.map((u) => {
                const isSelf = u.id === me?.userId;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-xs text-primary">
                          {(u.full_name || u.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-foreground">
                            {u.full_name || "Usuário"} {isSelf && "(Você)"}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={u.role || "viewer"}
                        onValueChange={(val) =>
                          setRoleMutation.mutate({ id: u.id, role: val as AppRole })
                        }
                        disabled={isSelf}
                      >
                        <SelectTrigger className="h-8 text-xs w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="master">{ROLE_LABEL.master}</SelectItem>
                          <SelectItem value="manager">{ROLE_LABEL.manager}</SelectItem>
                          <SelectItem value="editor">{ROLE_LABEL.editor}</SelectItem>
                          <SelectItem value="operator">{ROLE_LABEL.operator}</SelectItem>
                          <SelectItem value="viewer">{ROLE_LABEL.viewer}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                      >
                        <ShieldCheck className="h-3 w-3" /> Aprovado (Ativo)
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      {!isSelf ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                            onClick={() => {
                              if (
                                confirm(`Deseja revogar o acesso de ${u.full_name || u.email}?`)
                              ) {
                                approveMutation.mutate({ id: u.id, approved: false });
                              }
                            }}
                          >
                            <UserX className="h-3.5 w-3.5 mr-1" />
                            Revogar Acesso
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (
                                confirm(
                                  `Deseja remover o perfil de ${u.full_name || u.email}? A conta de login não será excluída e poderá solicitar acesso novamente.`,
                                )
                              ) {
                                deleteMutation.mutate(u.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          Administrador Principal
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {!isLoading && filteredActiveUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                    Nenhum usuário aprovado encontrado com os termos de busca.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
