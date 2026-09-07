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
import { Users } from "lucide-react";
import { toast } from "sonner";
import { type EmployeeData, formatCPF } from "@/lib/holerites";

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: EmployeeData | null;
  onSave: (data: Omit<EmployeeData, "id"> & { id?: string }) => Promise<void>;
}

export const EmployeeDialog: React.FC<EmployeeDialogProps> = ({
  open,
  onOpenChange,
  initialData,
  onSave,
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cbo, setCbo] = useState("");
  const [baseSalary, setBaseSalary] = useState<number | "">(2300);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setCode(initialData.code);
      setName(initialData.name);
      setCpf(initialData.cpf);
      setCbo(initialData.cbo);
      setBaseSalary(initialData.base_salary || "");
    } else {
      setCode("");
      setName("");
      setCpf("");
      setCbo("");
      setBaseSalary(2300);
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome do funcionário.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...(initialData?.id ? { id: initialData.id } : {}),
        code: code.trim() || "00",
        name: name.trim().toUpperCase(),
        cpf: formatCPF(cpf),
        cbo: cbo.trim().toUpperCase() || "COLABORADOR",
        base_salary: typeof baseSalary === "number" ? baseSalary : 0,
        active: true,
      });

      toast.success(initialData ? "Colaborador atualizado!" : "Colaborador cadastrado!");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar colaborador.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              <DialogTitle>
                {initialData ? "Editar Colaborador" : "Cadastrar Colaborador"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Cadastre os dados do colaborador para facilitar a geração de holerites futuros.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="emp-code" className="text-xs">
                  Código *
                </Label>
                <Input
                  id="emp-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="9016"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label htmlFor="emp-cpf" className="text-xs">
                  CPF *
                </Label>
                <Input
                  id="emp-cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  placeholder="111.782.324-50"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="emp-name" className="text-xs">
                Nome Completo *
              </Label>
              <Input
                id="emp-name"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="ISAULINA OLIVEIRA DA SILVA"
                className="h-8 text-xs font-mono uppercase"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="emp-cbo" className="text-xs">
                  CBO / Cargo *
                </Label>
                <Input
                  id="emp-cbo"
                  value={cbo}
                  onChange={(e) => setCbo(e.target.value.toUpperCase())}
                  placeholder="GERENTE"
                  className="h-8 text-xs font-mono uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="emp-salary" className="text-xs">
                  Salário Base (R$)
                </Label>
                <Input
                  id="emp-salary"
                  type="number"
                  step="0.01"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(parseFloat(e.target.value) || 0)}
                  placeholder="2300.00"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Colaborador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
