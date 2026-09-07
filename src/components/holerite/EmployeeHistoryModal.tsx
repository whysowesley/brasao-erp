import React, { useMemo } from "react";
import {
  History,
  ReceiptText,
  Printer,
  Pencil,
  Copy,
  Calendar,
  DollarSign,
  TrendingUp,
  User,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type HoleriteData, formatBrlCurrencyWithZero } from "@/lib/holerites";

interface EmployeeHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  cpf?: string;
  employeeCode?: string;
  cbo?: string;
  companyName?: string;
  allHolerites: HoleriteData[];
  onViewHolerite: (h: HoleriteData) => void;
  onEditHolerite: (h: HoleriteData) => void;
  onDuplicateHolerite: (h: HoleriteData) => void;
  onNewHolerite: (base?: HoleriteData) => void;
}

export const EmployeeHistoryModal: React.FC<EmployeeHistoryModalProps> = ({
  open,
  onOpenChange,
  employeeName,
  cpf,
  employeeCode,
  cbo,
  companyName,
  allHolerites,
  onViewHolerite,
  onEditHolerite,
  onDuplicateHolerite,
  onNewHolerite,
}) => {
  // Limpar formatação do CPF para comparação segura
  const cleanTargetCpf = (cpf || "").replace(/\D/g, "");
  const cleanTargetName = employeeName.trim().toLowerCase();

  // Filtrar todos os holerites que pertencem a este colaborador
  const historyList = useMemo(() => {
    return allHolerites.filter((h) => {
      const hCpfClean = (h.cpf || "").replace(/\D/g, "");
      const hNameClean = (h.employee_name || "").trim().toLowerCase();
      const hCodeClean = (h.employee_code || "").trim();

      // 1. Corresponde por CPF (se ambos tiverem CPF com ao menos 6 dígitos)
      if (cleanTargetCpf.length >= 6 && hCpfClean.length >= 6 && hCpfClean === cleanTargetCpf) {
        return true;
      }

      // 2. Corresponde por código do colaborador (se houver)
      if (employeeCode && employeeCode.trim() !== "" && hCodeClean === employeeCode.trim()) {
        return true;
      }

      // 3. Corresponde por nome exato
      if (cleanTargetName && hNameClean === cleanTargetName) {
        return true;
      }

      return false;
    });
  }, [allHolerites, cleanTargetCpf, cleanTargetName, employeeCode]);

  // Totais e métricas do histórico
  const totalPagamentos = historyList.length;
  const totalLiquidoAcumulado = useMemo(
    () => historyList.reduce((acc, h) => acc + (h.net_salary || 0), 0),
    [historyList],
  );
  const mediaSalarial = totalPagamentos > 0 ? totalLiquidoAcumulado / totalPagamentos : 0;
  const totalProventosAcumulado = useMemo(
    () => historyList.reduce((acc, h) => acc + (h.total_earnings || 0), 0),
    [historyList],
  );
  const totalDescontosAcumulado = useMemo(
    () => historyList.reduce((acc, h) => acc + (h.total_deductions || 0), 0),
    [historyList],
  );

  const latestHolerite = historyList[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <History className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Histórico de Holerites: {employeeName}</span>
                  {employeeCode && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Cód. {employeeCode}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                  {cpf && <span>CPF: {cpf}</span>}
                  {cbo && <span>• Cargo/CBO: {cbo}</span>}
                  {companyName && <span>• {companyName}</span>}
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onNewHolerite(latestHolerite);
              }}
              className="gap-1.5 text-xs bg-primary hover:bg-primary/90 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Holerite para Colaborador
            </Button>
          </div>
        </DialogHeader>

        {/* Métricas e Resumo Acumulado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <Card className="border-border/60 bg-muted/20">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                Recibos Emitidos
              </div>
              <div className="text-xl font-bold font-mono mt-1 text-foreground">
                {totalPagamentos} {totalPagamentos === 1 ? "mês" : "meses"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3">
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Total Líquido Pago
              </div>
              <div className="text-xl font-bold font-mono mt-1 text-emerald-600">
                R$ {formatBrlCurrencyWithZero(totalLiquidoAcumulado)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="text-[11px] text-primary font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Média Salarial Líquida
              </div>
              <div className="text-xl font-bold font-mono mt-1 text-primary">
                R$ {formatBrlCurrencyWithZero(mediaSalarial)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-muted/20">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                Descontos Acumulados
              </div>
              <div className="text-xl font-bold font-mono mt-1 text-rose-600">
                R$ {formatBrlCurrencyWithZero(totalDescontosAcumulado)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela do Histórico de Recibos */}
        <div className="flex-1 overflow-y-auto border rounded-lg">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0">
              <TableRow className="text-xs">
                <TableHead className="w-24">Mês Ref.</TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead className="text-right">Vencimentos</TableHead>
                <TableHead className="text-right">Descontos</TableHead>
                <TableHead className="text-right">Salário Líquido</TableHead>
                <TableHead className="text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyList.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-10 text-xs text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <ReceiptText className="h-8 w-8 text-muted-foreground/40" />
                      <span>
                        Nenhum recibo de pagamento registrado para este colaborador ainda.
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                historyList.map((h) => (
                  <TableRow key={h.id} className="text-xs hover:bg-muted/40 font-mono">
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300">
                        {h.reference_month || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="font-sans text-muted-foreground">
                      {h.date ? h.date.split("-").reverse().join("/") : "-"}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 font-semibold">
                      R$ {formatBrlCurrencyWithZero(h.total_earnings)}
                    </TableCell>
                    <TableCell className="text-right text-rose-600 font-semibold">
                      R$ {formatBrlCurrencyWithZero(h.total_deductions)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary text-sm">
                      R$ {formatBrlCurrencyWithZero(h.net_salary)}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1 font-sans">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            onOpenChange(false);
                            onViewHolerite(h);
                          }}
                          className="h-7 px-2 text-[11px] gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
                          title="Visualizar e Exportar PDF A4"
                        >
                          <Printer className="h-3 w-3" />
                          PDF A4
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            onOpenChange(false);
                            onDuplicateHolerite(h);
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Duplicar para outro mês"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            onOpenChange(false);
                            onEditHolerite(h);
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Editar este holerite"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
