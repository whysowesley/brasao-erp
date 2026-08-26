import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
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
import { useMovements } from "@/lib/data";
import { MOVEMENT_TYPES, formatDateTime, formatQty, movementLabel } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de Movimentações | Brasão" },
      {
        name: "description",
        content:
          "Registro permanente de todas as movimentações de estoque da Brasão: contagens, entradas, ajustes, perdas e correções.",
      },
      { property: "og:title", content: "Histórico de Movimentações | Brasão" },
      {
        property: "og:description",
        content: "Todas as alterações de estoque com data, usuário e observação.",
      },
    ],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const { data: movements, isLoading } = useMovements(undefined, 500);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");

  const rows = useMemo(() => {
    let list = movements ?? [];
    if (search.trim())
      list = list.filter((m) =>
        ((m.products as { description: string } | null)?.description ?? "")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      );
    if (type !== "todos") list = list.filter((m) => m.type === type);
    return list;
  }, [movements, search, type]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Histórico"
        description="Todas as movimentações de estoque. Registros nunca são apagados."
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Pesquisar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {MOVEMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / hora</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Movimentação</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
                <TableHead className="text-right">Movimentado</TableHead>
                <TableHead className="text-right">Final</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(m.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {(m.products as { description: string } | null)?.description}
                  </TableCell>
                  <TableCell>{movementLabel(m.type)}</TableCell>
                  <TableCell className="num text-right">{formatQty(m.quantity_before)}</TableCell>
                  <TableCell
                    className={`num text-right font-medium ${
                      Number(m.quantity_change) < 0 ? "text-critical" : "text-success"
                    }`}
                  >
                    {Number(m.quantity_change) > 0 ? "+" : ""}
                    {formatQty(m.quantity_change)}
                  </TableCell>
                  <TableCell className="num text-right">{formatQty(m.quantity_after)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.user_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.notes ?? ""}</TableCell>
                </TableRow>
              ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Nenhuma movimentação encontrada.
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
