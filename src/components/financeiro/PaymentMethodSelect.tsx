import { useState } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  Settings2,
  Check,
  Banknote,
  Receipt,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useDeletePaymentMethod,
} from "@/lib/financeiro";

interface PaymentMethodSelectProps {
  value: string;
  onValueChange: (val: string) => void;
  id?: string;
  placeholder?: string;
  canWrite?: boolean;
}

const COMMON_SUGGESTIONS = [
  { name: "Boleto", type: "boleto" },
  { name: "Cartão de Crédito", type: "cartao_credito" },
  { name: "Transferência Bancária", type: "transferencia" },
  { name: "Cartão de Débito", type: "cartao_debito" },
  { name: "PIX", type: "pix" },
  { name: "Dinheiro", type: "dinheiro" },
];

export function PaymentMethodSelect({
  value,
  onValueChange,
  id = "payment-method-select",
  placeholder = "Selecione a forma de pagamento...",
  canWrite = true,
}: PaymentMethodSelectProps) {
  const { data: paymentMethods = [], isLoading } = usePaymentMethods();
  const createMutation = useCreatePaymentMethod();
  const deleteMutation = useDeletePaymentMethod();

  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("boleto");
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const handleQuickAdd = async (item: { name: string; type: string }) => {
    if (!canWrite) {
      toast.error("Você não tem permissão para adicionar formas de pagamento.");
      return;
    }

    try {
      const createdId = await createMutation.mutateAsync({
        name: item.name,
        type: item.type,
        active: true,
      });
      onValueChange(createdId);
      toast.success(`Forma de pagamento "${item.name}" criada e selecionada!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar forma de pagamento.";
      toast.error(msg);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) {
      toast.error("Você não tem permissão para adicionar formas de pagamento.");
      return;
    }

    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Informe o nome da forma de pagamento.");
      return;
    }

    try {
      const createdId = await createMutation.mutateAsync({
        name: trimmed,
        type: newType,
        active: true,
      });
      onValueChange(createdId);
      setNewName("");
      toast.success(`Forma de pagamento "${trimmed}" cadastrada com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar forma de pagamento.";
      toast.error(msg);
    }
  };

  const handleDelete = async (pmId: string, pmName: string) => {
    if (!canWrite) {
      toast.error("Você não tem permissão para excluir formas de pagamento.");
      return;
    }

    setIsDeletingId(pmId);
    try {
      await deleteMutation.mutateAsync(pmId);
      if (value === pmId) {
        onValueChange("none");
      }
      toast.success(`Forma de pagamento "${pmName}" excluída.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir.";
      toast.error(msg);
    } finally {
      setIsDeletingId(null);
    }
  };

  const getMethodIcon = (type?: string) => {
    switch (type) {
      case "dinheiro":
        return <Banknote className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
      case "boleto":
        return <Receipt className="h-3.5 w-3.5 text-amber-600 shrink-0" />;
      case "transferencia":
        return <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600 shrink-0" />;
      default:
        return <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />;
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="flex-1">
          <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
            <SelectTrigger id={id} className="h-9">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">A definir / Não informada</SelectItem>
              {paymentMethods.map((pm) => (
                <SelectItem key={pm.id} value={pm.id}>
                  <div className="flex items-center gap-2">
                    {getMethodIcon(pm.type)}
                    <span>{pm.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      ({pm.type || "outros"})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canWrite && (
          <Popover open={isManageOpen} onOpenChange={setIsManageOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-xs gap-1 border-dashed hover:border-primary hover:text-primary shrink-0"
                title="Adicionar ou excluir métodos de pagamento (ex: Boleto, PIX, etc.)"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add / Excluir</span>
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[340px] sm:w-[380px] p-3.5 space-y-3" align="end">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-1.5">
                  <Settings2 className="h-4 w-4 text-primary" />
                  <h4 className="font-bold text-xs text-foreground">Métodos de Pagamento</h4>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {paymentMethods.length} cadastrados
                </span>
              </div>

              {/* Sugestões Rápidas (ex: Boleto, etc.) */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Adicionar Rápido com 1 Clique:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_SUGGESTIONS.map((item) => {
                    const alreadyExists = paymentMethods.some(
                      (pm) => pm.name.toLowerCase() === item.name.toLowerCase(),
                    );
                    if (alreadyExists) return null;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleQuickAdd(item)}
                        disabled={createMutation.isPending}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium border border-primary/20 transition-colors cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cadastro Personalizado */}
              <form onSubmit={handleCreateCustom} className="space-y-2 pt-1 border-t">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Novo Método Personalizado:
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: Boleto Santander..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2"
                  >
                    <option value="boleto">Boleto</option>
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao_credito">Crédito</option>
                    <option value="cartao_debito">Débito</option>
                    <option value="transferencia">Transf.</option>
                    <option value="outro">Outro</option>
                  </select>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createMutation.isPending || !newName.trim()}
                    className="h-8 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Salvar
                  </Button>
                </div>
              </form>

              {/* Lista dos Métodos com Botão de Excluir */}
              <div className="space-y-1 pt-1 border-t">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Métodos Disponíveis (Clique na lixeira para apagar):
                </Label>
                <div className="max-h-[160px] overflow-y-auto divide-y divide-border/60 rounded-md border border-border/70 bg-muted/20">
                  {paymentMethods.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      Nenhum método cadastrado. Clique acima para adicionar.
                    </div>
                  ) : (
                    paymentMethods.map((pm) => (
                      <div
                        key={pm.id}
                        className="flex items-center justify-between p-2 text-xs hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          {getMethodIcon(pm.type)}
                          <span className="font-semibold text-foreground truncate">{pm.name}</span>
                          <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                            {pm.type}
                          </Badge>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isDeletingId === pm.id}
                          onClick={() => handleDelete(pm.id, pm.name)}
                          className="h-6 w-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                          title={`Excluir método ${pm.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
