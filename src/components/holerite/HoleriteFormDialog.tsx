import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Sparkles, ReceiptText, Eye, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  type HoleriteData,
  type HoleriteItem,
  type EmployeeData,
  SAMPLE_PRINT_HOLERITE,
  COMMON_RUBRICAS,
  MONTHS_PT,
  formatBrlCurrencyWithZero,
  formatCPF,
  formatCNPJ,
} from "@/lib/holerites";
import { HoleriteReceipt } from "./HoleriteReceipt";

interface HoleriteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: HoleriteData | null;
  employees: EmployeeData[];
  onSave: (data: Omit<HoleriteData, "id"> & { id?: string }) => Promise<void>;
}

export const HoleriteFormDialog: React.FC<HoleriteFormDialogProps> = ({
  open,
  onOpenChange,
  initialData,
  employees,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");
  const [saving, setSaving] = useState(false);

  // Campos do formulário
  const [companyName, setCompanyName] = useState(SAMPLE_PRINT_HOLERITE.company_name);
  const [cnpj, setCnpj] = useState(SAMPLE_PRINT_HOLERITE.cnpj);
  const [referenceMonth, setReferenceMonth] = useState(SAMPLE_PRINT_HOLERITE.reference_month);
  const [date, setDate] = useState(SAMPLE_PRINT_HOLERITE.date);
  const [employeeCode, setEmployeeCode] = useState(SAMPLE_PRINT_HOLERITE.employee_code);
  const [employeeName, setEmployeeName] = useState(SAMPLE_PRINT_HOLERITE.employee_name);
  const [cbo, setCbo] = useState(SAMPLE_PRINT_HOLERITE.cbo);
  const [cpf, setCpf] = useState(SAMPLE_PRINT_HOLERITE.cpf);
  const [workedDays, setWorkedDays] = useState(SAMPLE_PRINT_HOLERITE.worked_days);
  const [emp, setEmp] = useState("01");
  const [local, setLocal] = useState("01");
  const [depto, setDepto] = useState("01");
  const [setor, setSetor] = useState("01");
  const [secao, setSecao] = useState("01");
  const [fl, setFl] = useState("01");
  const [notes, setNotes] = useState("");

  // Rubricas / Itens
  const [items, setItems] = useState<HoleriteItem[]>([...SAMPLE_PRINT_HOLERITE.items]);

  useEffect(() => {
    if (initialData) {
      setCompanyName(initialData.company_name || SAMPLE_PRINT_HOLERITE.company_name);
      setCnpj(initialData.cnpj || SAMPLE_PRINT_HOLERITE.cnpj);
      setReferenceMonth(initialData.reference_month || SAMPLE_PRINT_HOLERITE.reference_month);
      setDate(initialData.date || new Date().toISOString().split("T")[0]);
      setEmployeeCode(initialData.employee_code || "");
      setEmployeeName(initialData.employee_name || "");
      setCbo(initialData.cbo || "");
      setCpf(initialData.cpf || "");
      setWorkedDays(initialData.worked_days || "30d");
      setEmp(initialData.emp || "01");
      setLocal(initialData.local || "01");
      setDepto(initialData.depto || "01");
      setSetor(initialData.setor || "01");
      setSecao(initialData.secao || "01");
      setFl(initialData.fl || "01");
      setNotes(initialData.notes || "");
      setItems(
        initialData.items && initialData.items.length > 0
          ? [...initialData.items]
          : [...SAMPLE_PRINT_HOLERITE.items],
      );
    } else {
      // Padrão novo com modelo do print
      const now = new Date();
      const currentM = `${MONTHS_PT[now.getMonth()]}/${now.getFullYear()}`;
      setCompanyName(SAMPLE_PRINT_HOLERITE.company_name);
      setCnpj(SAMPLE_PRINT_HOLERITE.cnpj);
      setReferenceMonth(currentM);
      setDate(now.toISOString().split("T")[0]);
      setEmployeeCode(SAMPLE_PRINT_HOLERITE.employee_code);
      setEmployeeName(SAMPLE_PRINT_HOLERITE.employee_name);
      setCbo(SAMPLE_PRINT_HOLERITE.cbo);
      setCpf(SAMPLE_PRINT_HOLERITE.cpf);
      setWorkedDays(SAMPLE_PRINT_HOLERITE.worked_days);
      setEmp("01");
      setLocal("01");
      setDepto("01");
      setSetor("01");
      setSecao("01");
      setFl("01");
      setNotes("");
      setItems([...SAMPLE_PRINT_HOLERITE.items]);
    }
    setActiveTab("form");
  }, [initialData, open]);

  // Totais calculados automaticamente
  const totalEarnings = items.reduce((acc, it) => acc + (Number(it.earnings) || 0), 0);
  const totalDeductions = items.reduce((acc, it) => acc + (Number(it.deductions) || 0), 0);
  const netSalary = Math.max(0, totalEarnings - totalDeductions);

  // Seleção rápida de funcionário cadastrado
  const handleSelectEmployee = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setEmployeeCode(emp.code);
    setEmployeeName(emp.name);
    setCpf(emp.cpf);
    setCbo(emp.cbo);
    if (emp.base_salary && emp.base_salary > 0) {
      // Atualiza o item de salário contratual se existir
      setItems((prev) => {
        const next = [...prev];
        const salaryIdx = next.findIndex(
          (it) => it.code === "02" || it.description.includes("SALARIO"),
        );
        if (salaryIdx >= 0) {
          next[salaryIdx] = {
            ...next[salaryIdx],
            earnings: emp.base_salary,
          };
        } else {
          next.unshift({
            code: "02",
            description: "SALARIO CONTRATUAL",
            reference: "30d",
            earnings: emp.base_salary,
            deductions: 0,
          });
        }
        return next;
      });
    }
    toast.success(`Dados de ${emp.name} preenchidos!`);
  };

  // Carregar modelo exato do print
  const handleLoadSamplePrint = () => {
    setCompanyName(SAMPLE_PRINT_HOLERITE.company_name);
    setCnpj(SAMPLE_PRINT_HOLERITE.cnpj);
    setReferenceMonth("AGOSTO/2026");
    setDate("2026-08-31");
    setEmployeeCode(SAMPLE_PRINT_HOLERITE.employee_code);
    setEmployeeName(SAMPLE_PRINT_HOLERITE.employee_name);
    setCbo(SAMPLE_PRINT_HOLERITE.cbo);
    setCpf(SAMPLE_PRINT_HOLERITE.cpf);
    setWorkedDays(SAMPLE_PRINT_HOLERITE.worked_days);
    setItems([...SAMPLE_PRINT_HOLERITE.items]);
    toast.info("Valores idênticos ao modelo do print carregados!");
  };

  // Manipulação de itens
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { code: "", description: "", reference: "", earnings: 0, deductions: 0 },
    ]);
  };

  const handleAddPresetItem = (preset: (typeof COMMON_RUBRICAS)[number]) => {
    setItems((prev) => [
      ...prev,
      {
        code: preset.code,
        description: preset.description,
        reference: preset.defaultRef,
        earnings: preset.type === "earnings" ? 0 : 0,
        deductions: preset.type === "deductions" ? 0 : 0,
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof HoleriteItem, val: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName.trim()) {
      toast.error("Informe o nome do funcionário.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...(initialData?.id ? { id: initialData.id } : {}),
        company_name: companyName.trim() || SAMPLE_PRINT_HOLERITE.company_name,
        cnpj: cnpj.trim() || SAMPLE_PRINT_HOLERITE.cnpj,
        reference_month: referenceMonth.trim() || "AGOSTO/2026",
        date: date || new Date().toISOString().split("T")[0],
        employee_code: employeeCode.trim() || "00",
        employee_name: employeeName.trim().toUpperCase(),
        cbo: cbo.trim().toUpperCase() || "COLABORADOR",
        cpf: formatCPF(cpf),
        worked_days: workedDays.trim() || "30d",
        emp,
        local,
        depto,
        setor,
        secao,
        fl,
        notes: notes.trim(),
        items: items.filter((it) => it.description.trim() || it.earnings || it.deductions),
        total_earnings: totalEarnings,
        total_deductions: totalDeductions,
        net_salary: netSalary,
      });

      toast.success(initialData ? "Holerite atualizado!" : "Holerite cadastrado com sucesso!");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar holerite.");
    } finally {
      setSaving(false);
    }
  };

  // Objeto temporário para a aba de prévia em tempo real
  const previewData: HoleriteData = {
    id: initialData?.id || "preview-temp",
    company_name: companyName,
    cnpj,
    reference_month: referenceMonth,
    date,
    employee_code: employeeCode,
    employee_name: employeeName || "NOME DO FUNCIONÁRIO",
    cbo: cbo || "CARGO",
    cpf,
    worked_days: workedDays,
    emp,
    local,
    depto,
    setor,
    secao,
    fl,
    items,
    total_earnings: totalEarnings,
    total_deductions: totalDeductions,
    net_salary: netSalary,
    notes,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-amber-600" />
              <DialogTitle className="text-lg">
                {initialData ? "Editar Holerite" : "Novo Holerite (Recibo de Pagamento)"}
              </DialogTitle>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadSamplePrint}
              className="gap-1 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Modelo do Print
            </Button>
          </div>
          <DialogDescription className="text-xs">
            Preencha os dados do colaborador, proventos e descontos com cálculo em tempo real e
            visualização fiel ao modelo.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "form" | "preview")}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-4 border-b flex items-center justify-between bg-muted/30">
            <TabsList className="h-9">
              <TabsTrigger value="form" className="text-xs gap-1.5">
                <ReceiptText className="h-3.5 w-3.5" />
                Formulário & Rubricas
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Pré-visualização do Design
              </TabsTrigger>
            </TabsList>

            {/* Resumo Rápido no Topo */}
            <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
              <span className="text-emerald-600 font-semibold">
                Prov: R$ {formatBrlCurrencyWithZero(totalEarnings)}
              </span>
              <span className="text-rose-600 font-semibold">
                Desc: R$ {formatBrlCurrencyWithZero(totalDeductions)}
              </span>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                Líquido: R$ {formatBrlCurrencyWithZero(netSalary)}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <TabsContent value="form" className="m-0 space-y-4">
              {/* Seleção de Funcionário Cadastrado */}
              {employees.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
                    <UserCheck className="h-4 w-4 text-amber-600" />
                    <span>Selecionar Colaborador Pré-Cadastrado:</span>
                  </div>
                  <Select onValueChange={handleSelectEmployee}>
                    <SelectTrigger className="w-full sm:w-64 h-8 text-xs bg-background">
                      <SelectValue placeholder="Escolha um colaborador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id} className="text-xs">
                          {e.code} - {e.name} ({e.cbo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Bloco 1: Empresa & Competência */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-muted/20 border rounded-lg">
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="companyName" className="text-xs font-semibold">
                    Razão Social / Empresa
                  </Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="099 - GBM ALIMENTOS E BEBIDAS LTDA"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cnpj" className="text-xs font-semibold">
                    CNPJ
                  </Label>
                  <Input
                    id="cnpj"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    placeholder="57.772.207/0001-00"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="referenceMonth" className="text-xs font-semibold">
                    Mês/Ano Vigente
                  </Label>
                  <Input
                    id="referenceMonth"
                    value={referenceMonth}
                    onChange={(e) => setReferenceMonth(e.target.value.toUpperCase())}
                    placeholder="AGOSTO/2026"
                    className="h-8 text-xs font-mono font-bold uppercase"
                  />
                </div>
              </div>

              {/* Bloco 2: Dados do Funcionário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 p-3 bg-muted/20 border rounded-lg">
                <div className="sm:col-span-1 space-y-1">
                  <Label htmlFor="employeeCode" className="text-xs font-semibold">
                    Cód. Func.
                  </Label>
                  <Input
                    id="employeeCode"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    placeholder="9016"
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="employeeName" className="text-xs font-semibold">
                    Nome Completo do Funcionário *
                  </Label>
                  <Input
                    id="employeeName"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value.toUpperCase())}
                    placeholder="ISAULINA OLIVEIRA DA SILVA"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>

                <div className="sm:col-span-1 space-y-1">
                  <Label htmlFor="cpf" className="text-xs font-semibold">
                    CPF
                  </Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="111.782.324-50"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-1 space-y-1">
                  <Label htmlFor="cbo" className="text-xs font-semibold">
                    CBO / Cargo
                  </Label>
                  <Input
                    id="cbo"
                    value={cbo}
                    onChange={(e) => setCbo(e.target.value.toUpperCase())}
                    placeholder="GERENTE"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>

                <div className="sm:col-span-1 space-y-1">
                  <Label htmlFor="workedDays" className="text-xs font-semibold">
                    Dias Trabalhados / Ref.
                  </Label>
                  <Input
                    id="workedDays"
                    value={workedDays}
                    onChange={(e) => setWorkedDays(e.target.value)}
                    placeholder="3100,00% ou 30d"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                {/* Subcampos adicionais do recibo */}
                <div className="sm:col-span-6 grid grid-cols-6 gap-2 pt-2 border-t text-xs">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Emp.</Label>
                    <Input
                      value={emp}
                      onChange={(e) => setEmp(e.target.value)}
                      className="h-7 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Local</Label>
                    <Input
                      value={local}
                      onChange={(e) => setLocal(e.target.value)}
                      className="h-7 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Depto.</Label>
                    <Input
                      value={depto}
                      onChange={(e) => setDepto(e.target.value)}
                      className="h-7 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Setor</Label>
                    <Input
                      value={setor}
                      onChange={(e) => setSetor(e.target.value)}
                      className="h-7 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Seção</Label>
                    <Input
                      value={secao}
                      onChange={(e) => setSecao(e.target.value)}
                      className="h-7 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Data Pagto</Label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Bloco 3: Rubricas / Itens do Holerite */}
              <div className="space-y-2 border rounded-lg p-3 bg-muted/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-xs text-foreground">
                    Rubricas de Proventos e Descontos ({items.length} itens)
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Botões Rápidos de Presets Comuns */}
                    <span className="text-[10px] text-muted-foreground mr-1 hidden sm:inline">
                      Adicionar rápido:
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetItem(COMMON_RUBRICAS[0])}
                      className="h-6 px-2 text-[10px]"
                    >
                      + Salário (02)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetItem(COMMON_RUBRICAS[9])}
                      className="h-6 px-2 text-[10px]"
                    >
                      + Vale Transp. (463)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetItem(COMMON_RUBRICAS[7])}
                      className="h-6 px-2 text-[10px]"
                    >
                      + INSS (453)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddItem}
                      className="h-6 px-2 text-[10px] gap-1 bg-primary"
                    >
                      <Plus className="h-3 w-3" />
                      Nova Linha
                    </Button>
                  </div>
                </div>

                {/* Tabela de Itens Editáveis */}
                <div className="border rounded-md overflow-hidden bg-background">
                  <div className="grid grid-cols-12 gap-1 p-2 bg-muted/60 text-[10px] font-bold text-muted-foreground uppercase border-b">
                    <div className="col-span-1 text-center">Cód.</div>
                    <div className="col-span-5">Descrição</div>
                    <div className="col-span-2 text-center">Referência</div>
                    <div className="col-span-2 text-right">Proventos (R$)</div>
                    <div className="col-span-2 text-right">Descontos (R$)</div>
                  </div>

                  <div className="divide-y max-h-60 overflow-y-auto">
                    {items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1 p-1.5 items-center text-xs">
                        <div className="col-span-1">
                          <Input
                            value={item.code}
                            onChange={(e) => handleUpdateItem(idx, "code", e.target.value)}
                            placeholder="02"
                            className="h-7 text-xs font-mono text-center p-1"
                          />
                        </div>
                        <div className="col-span-5">
                          <Input
                            value={item.description}
                            onChange={(e) =>
                              handleUpdateItem(idx, "description", e.target.value.toUpperCase())
                            }
                            placeholder="SALARIO CONTRATUAL"
                            className="h-7 text-xs font-mono uppercase p-1.5"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            value={item.reference}
                            onChange={(e) => handleUpdateItem(idx, "reference", e.target.value)}
                            placeholder="30d / 6%"
                            className="h-7 text-xs font-mono text-center p-1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.earnings || ""}
                            onChange={(e) =>
                              handleUpdateItem(idx, "earnings", parseFloat(e.target.value) || 0)
                            }
                            placeholder="0,00"
                            className="h-7 text-xs font-mono text-right p-1 text-emerald-600 font-semibold"
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.deductions || ""}
                            onChange={(e) =>
                              handleUpdateItem(idx, "deductions", parseFloat(e.target.value) || 0)
                            }
                            placeholder="0,00"
                            className="h-7 text-xs font-mono text-right p-1 text-rose-600 font-semibold"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(idx)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Barra de Totais */}
                  <div className="grid grid-cols-12 gap-1 p-2 bg-muted/40 font-mono text-xs font-bold border-t">
                    <div className="col-span-8 text-right pr-2">TOTAIS CALCULADOS:</div>
                    <div className="col-span-2 text-right text-emerald-600">
                      R$ {formatBrlCurrencyWithZero(totalEarnings)}
                    </div>
                    <div className="col-span-2 text-right text-rose-600 pr-7">
                      R$ {formatBrlCurrencyWithZero(totalDeductions)}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="preview"
              className="m-0 flex flex-col items-center justify-center p-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg"
            >
              <div className="text-xs text-muted-foreground mb-2">
                Pré-visualização exata da 1ª via (Colaborador)
              </div>
              <HoleriteReceipt data={previewData} copyLabel="1ª VIA - COLABORADOR" />
            </TabsContent>
          </div>

          <DialogFooter className="p-3 border-t bg-muted/20 flex items-center justify-between sm:justify-between">
            <div className="text-xs font-bold font-mono">
              VALOR LÍQUIDO:{" "}
              <span className="text-primary text-sm">
                R$ {formatBrlCurrencyWithZero(netSalary)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={saving}
                className="bg-primary font-semibold"
              >
                {saving ? "Salvando..." : initialData ? "Atualizar Holerite" : "Salvar Holerite"}
              </Button>
            </div>
          </DialogFooter>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
