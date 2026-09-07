import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ReceiptText,
  Plus,
  Search,
  Printer,
  FileDown,
  Trash2,
  Pencil,
  Copy,
  Users,
  Eye,
  CheckCircle2,
  Sparkles,
  DollarSign,
  TrendingDown,
  Building,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type HoleriteData,
  type EmployeeData,
  SAMPLE_PRINT_HOLERITE,
  formatBrlCurrencyWithZero,
} from "@/lib/holerites";
import {
  useHolerites,
  useSaveHolerite,
  useDeleteHolerite,
  useEmployees,
  useSaveEmployee,
  useDeleteEmployee,
} from "@/lib/holerites-data";
import { HoleriteFormDialog } from "@/components/holerite/HoleriteFormDialog";
import { HoleriteViewModal } from "@/components/holerite/HoleriteViewModal";
import { EmployeeDialog } from "@/components/holerite/EmployeeDialog";

export const Route = createFileRoute("/_authenticated/holerites")({
  head: () => ({
    meta: [
      { title: "Holerites & Recibos de Salário | Brasão ERP" },
      {
        name: "description",
        content:
          "Emissão de holerites com design idêntico ao modelo e exportação em PDF A4 (duas vias)",
      },
    ],
  }),
  component: HoleritesPage,
});

function HoleritesPage() {
  const { data: holerites = [], isLoading } = useHolerites();
  const saveHoleriteMutation = useSaveHolerite();
  const deleteHoleriteMutation = useDeleteHolerite();

  const { data: employees = [] } = useEmployees();
  const saveEmployeeMutation = useSaveEmployee();
  const deleteEmployeeMutation = useDeleteEmployee();

  // Estados de busca e filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");

  // Diálogos
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingHolerite, setEditingHolerite] = useState<HoleriteData | null>(null);

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingHolerite, setViewingHolerite] = useState<HoleriteData | null>(null);

  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeData | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"holerite" | "employee">("holerite");

  // Meses únicos para filtro
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    holerites.forEach((h) => {
      if (h.reference_month) set.add(h.reference_month);
    });
    return Array.from(set);
  }, [holerites]);

  // Lista filtrada de holerites
  const filteredHolerites = useMemo(() => {
    return holerites.filter((h) => {
      const matchesSearch =
        searchTerm === "" ||
        h.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.cpf?.includes(searchTerm) ||
        h.cbo?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMonth = selectedMonth === "ALL" || h.reference_month === selectedMonth;

      return matchesSearch && matchesMonth;
    });
  }, [holerites, searchTerm, selectedMonth]);

  // Totais das métricas
  const totalVencimentos = useMemo(
    () => filteredHolerites.reduce((acc, h) => acc + (h.total_earnings || 0), 0),
    [filteredHolerites],
  );
  const totalDescontos = useMemo(
    () => filteredHolerites.reduce((acc, h) => acc + (h.total_deductions || 0), 0),
    [filteredHolerites],
  );
  const totalLiquido = useMemo(
    () => filteredHolerites.reduce((acc, h) => acc + (h.net_salary || 0), 0),
    [filteredHolerites],
  );

  // Ações
  const handleOpenNew = () => {
    setEditingHolerite(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (item: HoleriteData) => {
    setEditingHolerite(item);
    setFormDialogOpen(true);
  };

  const handleDuplicate = async (item: HoleriteData) => {
    try {
      await saveHoleriteMutation.mutateAsync({
        ...item,
        id: undefined,
        employee_name: `${item.employee_name} (CÓPIA)`,
      });
      toast.success("Holerite duplicado com sucesso!");
    } catch {
      toast.error("Erro ao duplicar holerite.");
    }
  };

  const handleView = (item: HoleriteData) => {
    setViewingHolerite(item);
    setViewModalOpen(true);
  };

  const handleImportSample = async () => {
    try {
      await saveHoleriteMutation.mutateAsync({
        ...SAMPLE_PRINT_HOLERITE,
      });
      toast.success("Modelo do print importado com sucesso!");
    } catch {
      toast.error("Erro ao importar modelo.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      if (deleteType === "holerite") {
        await deleteHoleriteMutation.mutateAsync(deleteConfirmId);
        toast.success("Holerite removido.");
      } else {
        await deleteEmployeeMutation.mutateAsync(deleteConfirmId);
        toast.success("Colaborador removido.");
      }
    } catch {
      toast.error("Erro ao remover registro.");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleCreateFromEmployee = (emp: EmployeeData) => {
    const now = new Date();
    const currentM = `MÊS/${now.getFullYear()}`;
    const baseH: HoleriteData = {
      ...SAMPLE_PRINT_HOLERITE,
      id: "",
      employee_code: emp.code,
      employee_name: emp.name,
      cpf: emp.cpf,
      cbo: emp.cbo,
      items: [
        {
          code: "02",
          description: "SALARIO CONTRATUAL",
          reference: "30d",
          earnings: emp.base_salary || 2300,
          deductions: 0,
        },
      ],
      total_earnings: emp.base_salary || 2300,
      total_deductions: 0,
      net_salary: emp.base_salary || 2300,
      reference_month: currentM,
    };
    setEditingHolerite(baseH);
    setFormDialogOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Emissão de Holerites"
        description="Sistema de geração de Recibos de Pagamento de Salário com design fiel ao modelo e exportação em PDF A4 (duas vias na mesma folha: Colaborador e Empresa)."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportSample}
            className="gap-1.5 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Carregar Modelo do Print
          </Button>

          <Button
            size="sm"
            onClick={handleOpenNew}
            className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Novo Holerite
          </Button>
        </div>
      </PageHeader>

      {/* Cartões de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Recibos Emitidos</div>
              <div className="text-2xl font-bold font-mono mt-1">{filteredHolerites.length}</div>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-lg">
              <ReceiptText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total de Vencimentos</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                R$ {formatBrlCurrencyWithZero(totalVencimentos)}
              </div>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total de Descontos</div>
              <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
                R$ {formatBrlCurrencyWithZero(totalDescontos)}
              </div>
            </div>
            <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-lg">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Líquido a Pagar</div>
              <div className="text-2xl font-bold font-mono text-primary mt-1">
                R$ {formatBrlCurrencyWithZero(totalLiquido)}
              </div>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="holerites" className="space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="holerites" className="text-xs gap-1.5">
            <ReceiptText className="h-3.5 w-3.5" />
            Recibos de Salário ({filteredHolerites.length})
          </TabsTrigger>
          <TabsTrigger value="employees" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Cadastro de Colaboradores ({employees.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA: RECIBOS DE SALÁRIO */}
        <TabsContent value="holerites" className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por colaborador, código, CPF ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-44 h-9 text-xs bg-background">
                  <SelectValue placeholder="Filtrar por Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Meses</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela de Holerites */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold">
                Recibos de Pagamento Cadastrados
              </CardTitle>
              <CardDescription className="text-xs">
                Clique em &quot;Visualizar / PDF&quot; para abrir a visualização idêntica ao print
                com as duas vias (Colaborador e Empresa) prontas para impressão e exportação A4.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-16">Cód.</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>CPF / Cargo</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead className="text-right">Proventos</TableHead>
                    <TableHead className="text-right">Descontos</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        Carregando holerites...
                      </TableCell>
                    </TableRow>
                  ) : filteredHolerites.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-10 text-xs text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <ReceiptText className="h-8 w-8 text-muted-foreground/50" />
                          <span>Nenhum recibo de salário encontrado.</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleOpenNew}
                            className="text-xs mt-2"
                          >
                            Criar Primeiro Holerite
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHolerites.map((h) => (
                      <TableRow key={h.id} className="text-xs hover:bg-muted/40 font-mono">
                        <TableCell className="font-bold text-foreground">
                          {h.employee_code || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-foreground uppercase">
                            {h.employee_name}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-sans truncate max-w-xs">
                            {h.company_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{h.cpf || "-"}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {h.cbo || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            {h.reference_month || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">
                          R$ {formatBrlCurrencyWithZero(h.total_earnings)}
                        </TableCell>
                        <TableCell className="text-right text-rose-600 font-semibold">
                          R$ {formatBrlCurrencyWithZero(h.total_deductions)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          R$ {formatBrlCurrencyWithZero(h.net_salary)}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1 font-sans">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleView(h)}
                              className="h-7 px-2 text-[11px] gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                              title="Visualizar e Exportar PDF A4 (2 vias)"
                            >
                              <Printer className="h-3 w-3" />
                              PDF / Imprimir
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDuplicate(h)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Duplicar recibo"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(h)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Editar holerite"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteConfirmId(h.id);
                                setDeleteType("holerite");
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title="Excluir holerite"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: CADASTRO DE COLABORADORES */}
        <TabsContent value="employees" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Equipe & Colaboradores</h3>
              <p className="text-xs text-muted-foreground">
                Cadastre os colaboradores para facilitar a seleção rápida e emissão de holerites
                recorrentes.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingEmployee(null);
                setEmployeeDialogOpen(true);
              }}
              className="gap-1.5 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Colaborador
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-20">Código</TableHead>
                    <TableHead>Nome Completo</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Cargo / CBO</TableHead>
                    <TableHead className="text-right">Salário Base</TableHead>
                    <TableHead className="text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        Nenhum colaborador cadastrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((e) => (
                      <TableRow key={e.id} className="text-xs font-mono">
                        <TableCell className="font-bold">{e.code}</TableCell>
                        <TableCell className="font-bold uppercase">{e.name}</TableCell>
                        <TableCell>{e.cpf}</TableCell>
                        <TableCell className="uppercase">{e.cbo}</TableCell>
                        <TableCell className="text-right font-semibold">
                          R$ {formatBrlCurrencyWithZero(e.base_salary)}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1 font-sans">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCreateFromEmployee(e)}
                              className="h-7 px-2 text-[11px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            >
                              <ReceiptText className="h-3 w-3" />
                              Gerar Holerite
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingEmployee(e);
                                setEmployeeDialogOpen(true);
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteConfirmId(e.id);
                                setDeleteType("employee");
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de Criar/Editar Holerite */}
      <HoleriteFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        initialData={editingHolerite}
        employees={employees}
        onSave={async (data) => {
          await saveHoleriteMutation.mutateAsync(data);
        }}
      />

      {/* Modal de Visualização com as 2 Vias (Colaborador e Empresa) e Exportação A4 */}
      <HoleriteViewModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        data={viewingHolerite}
      />

      {/* Diálogo de Colaborador */}
      <EmployeeDialog
        open={employeeDialogOpen}
        onOpenChange={setEmployeeDialogOpen}
        initialData={editingEmployee}
        onSave={async (data) => {
          await saveEmployeeMutation.mutateAsync(data);
        }}
      />

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja realmente excluir este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o {deleteType === "holerite" ? "holerite" : "colaborador"} de forma
              permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
