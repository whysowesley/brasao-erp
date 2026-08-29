import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Phone, Mail, CreditCard, FileText, User, Hash, Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvalidateAll, saveSupplier } from "@/lib/data";
import { useAuth } from "@/lib/auth";

export interface SupplierData {
  id?: string;
  name: string;
  cnpj_cpf?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  pix_key?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  notes?: string | null;
}

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierToEdit?: SupplierData | null;
}

export function SupplierDialog({ open, onOpenChange, supplierToEdit }: SupplierDialogProps) {
  const { canWrite } = useAuth();
  const invalidate = useInvalidateAll();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campos
  const [name, setName] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [notes, setNotes] = useState("");

  const isEditing = !!supplierToEdit?.id;

  useEffect(() => {
    if (supplierToEdit) {
      setName(supplierToEdit.name || "");
      setCnpjCpf(supplierToEdit.cnpj_cpf || "");
      setContact(supplierToEdit.contact || "");
      setPhone(supplierToEdit.phone || "");
      setEmail(supplierToEdit.email || "");
      setPixKey(supplierToEdit.pix_key || "");
      setBankName(supplierToEdit.bank_name || "");
      setBankAgency(supplierToEdit.bank_agency || "");
      setBankAccount(supplierToEdit.bank_account || "");
      setNotes(supplierToEdit.notes || "");
    } else {
      setName("");
      setCnpjCpf("");
      setContact("");
      setPhone("");
      setEmail("");
      setPixKey("");
      setBankName("");
      setBankAgency("");
      setBankAccount("");
      setNotes("");
    }
  }, [supplierToEdit, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) {
      toast.error("Você não tem permissão para cadastrar ou editar fornecedores.");
      return;
    }

    const trimmedName = name.trim().toUpperCase();
    if (!trimmedName) {
      toast.error("O nome do fornecedor é obrigatório.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        cnpj_cpf: cnpjCpf.trim() || null,
        contact: contact.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        pix_key: pixKey.trim() || null,
        bank_name: bankName.trim() || null,
        bank_agency: bankAgency.trim() || null,
        bank_account: bankAccount.trim() || null,
        notes: notes.trim() || null,
      };

      await saveSupplier(payload, isEditing && supplierToEdit?.id ? supplierToEdit.id : undefined);
      toast.success(
        isEditing ? "Fornecedor atualizado com sucesso." : "Fornecedor cadastrado com sucesso.",
      );

      invalidate();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar fornecedor.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>{isEditing ? "Editar Fornecedor" : "Novo Fornecedor"}</span>
            </DialogTitle>
            <DialogDescription>
              Cadastro unificado do fornecedor para Estoque, Pedidos de Compra e Módulo Financeiro.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="geral" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="geral">Identificação & Contato</TabsTrigger>
              <TabsTrigger value="financeiro">Dados Bancários & PIX</TabsTrigger>
            </TabsList>

            {/* Aba Geral */}
            <TabsContent value="geral" className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="supplier-name">
                  Nome / Razão Social <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="supplier-name"
                  placeholder="Ex: HORTIFRÚTI CENTRAL LTDA"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-cnpj" className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    CNPJ / CPF
                  </Label>
                  <Input
                    id="supplier-cnpj"
                    placeholder="00.000.000/0000-00"
                    value={cnpjCpf}
                    onChange={(e) => setCnpjCpf(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supplier-contact" className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Nome do Contato
                  </Label>
                  <Input
                    id="supplier-contact"
                    placeholder="Ex: Roberto Carlos"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-phone" className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Telefone / WhatsApp
                  </Label>
                  <Input
                    id="supplier-phone"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supplier-email" className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    E-mail
                  </Label>
                  <Input
                    id="supplier-email"
                    type="email"
                    placeholder="contato@fornecedor.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Aba Financeiro */}
            <TabsContent value="financeiro" className="space-y-4 pt-3">
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                Estes dados são <strong>opcionais</strong> e servem para agilizar pagamentos e
                quitações no Módulo Financeiro.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="supplier-pix" className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  Chave PIX
                </Label>
                <Input
                  id="supplier-pix"
                  placeholder="CNPJ, CPF, E-mail, Celular ou Chave Aleatória"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-bank" className="flex items-center gap-1">
                    <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                    Banco
                  </Label>
                  <Input
                    id="supplier-bank"
                    placeholder="Ex: Itaú / Bradesco"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supplier-agency">Agência</Label>
                  <Input
                    id="supplier-agency"
                    placeholder="0001"
                    value={bankAgency}
                    onChange={(e) => setBankAgency(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supplier-account">Conta</Label>
                  <Input
                    id="supplier-account"
                    placeholder="12345-6"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="supplier-notes" className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Observações Gerais
                </Label>
                <Textarea
                  id="supplier-notes"
                  placeholder="Condições de pagamento, dias de entrega, prazos, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !canWrite}>
              {isSubmitting
                ? "Salvando..."
                : isEditing
                  ? "Salvar Alterações"
                  : "Cadastrar Fornecedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
