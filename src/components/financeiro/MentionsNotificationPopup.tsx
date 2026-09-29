import { useState } from "react";
import {
  Bell,
  MessageSquare,
  Check,
  CheckCheck,
  Building2,
  Calendar,
  X,
  ExternalLink,
  User,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserMentions, type PendingMentionItem } from "@/lib/use-user-mentions";
import { TransactionCommentsDialog } from "./TransactionCommentsDialog";
import { useAuth } from "@/lib/auth";
import type { FinancialTransaction } from "@/lib/financeiro-types";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function formatDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

interface MentionsNotificationPopupProps {
  // Opcional se for embutido como botão em cabeçalhos
  variant?: "trigger" | "floating" | "all";
}

export function MentionsNotificationPopup({ variant = "all" }: MentionsNotificationPopupProps) {
  const { unreadMentions, pendingMentions, unreadCount, markAsRead, markAllAsRead } =
    useUserMentions();
  const { canWrite } = useAuth();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [floatingDismissed, setFloatingDismissed] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);

  const handleOpenTransactionComments = async (item: PendingMentionItem) => {
    // Marca como lida ao abrir
    await markAsRead(item.transactionId, item.id);
    setSelectedTransaction(item.transaction);
  };

  const handleMarkAsReadSingle = async (e: React.MouseEvent, item: PendingMentionItem) => {
    e.stopPropagation();
    await markAsRead(item.transactionId, item.id);
  };

  return (
    <>
      {/* Botão de Sino com Badge (Para Cabeçalho) */}
      {(variant === "trigger" || variant === "all") && (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="relative inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer select-none"
          title={
            unreadCount > 0
              ? `Você tem ${unreadCount} menção(ões) pendente(s)`
              : "Menções em lançamentos"
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Pop-up Flutuante Não-Intrusivo quando há menções pendentes */}
      {(variant === "floating" || variant === "all") &&
        unreadCount > 0 &&
        !floatingDismissed &&
        !dialogOpen && (
          <div className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] bg-card border border-blue-500/30 dark:border-blue-400/40 rounded-xl shadow-xl p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="h-4 w-4" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-foreground">Você foi mencionado!</span>
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] h-4 px-1.5">
                  {unreadCount} pendente{unreadCount > 1 ? "s" : ""}
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {unreadMentions[0]?.authorName} mencionou você em{" "}
                <strong>{unreadMentions[0]?.supplierName}</strong>: &ldquo;
                {unreadMentions[0]?.text}&rdquo;
              </p>

              <div className="mt-2.5 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  className="h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Ver Menções
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFloatingDismissed(true)}
                  className="h-7 text-xs px-2 text-muted-foreground"
                >
                  Lembrar depois
                </Button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFloatingDismissed(true)}
              className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded transition-colors"
              title="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

      {/* Modal / Dialog de Menções Pendentes */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg w-[95vw] p-4 sm:p-6 bg-background flex flex-col max-h-[85vh]">
          <DialogHeader className="border-b pb-3 text-left shrink-0">
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-600" />
                Menções em Lançamentos
                {unreadCount > 0 ? (
                  <Badge variant="destructive" className="text-xs font-bold">
                    {unreadCount} não lida{unreadCount > 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Todas lidas
                  </Badge>
                )}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-0.5">
              Comentários e notas financeiras em que outros usuários mencionaram seu nome ou e-mail.
            </DialogDescription>
          </DialogHeader>

          {pendingMentions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-xs font-medium">Nenhuma menção encontrada para o seu usuário.</p>
              <p className="text-[11px] text-muted-foreground/70">
                Quando alguém usar @SeuNome em algum lançamento, ele aparecerá aqui.
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-2 -mr-2 my-2 max-h-[50vh]">
              <div className="space-y-2.5">
                {pendingMentions.map((item) => {
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenTransactionComments(item)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer select-none text-left relative ${
                        item.isUnread
                          ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 shadow-xs hover:border-blue-500"
                          : "bg-card border-border hover:bg-muted/40 opacity-80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {item.authorName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {item.authorName}{" "}
                              <span className="font-normal text-muted-foreground text-[11px]">
                                mencionou você
                              </span>
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDate(item.createdAt)}
                            </p>
                          </div>
                        </div>

                        {item.isUnread ? (
                          <div className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => handleMarkAsReadSingle(e, item)}
                              className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                              title="Marcar apenas esta como lida"
                            >
                              <Check className="h-3 w-3 mr-0.5" />
                              Lida
                            </Button>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] text-muted-foreground h-4 px-1"
                          >
                            Lida
                          </Badge>
                        )}
                      </div>

                      {/* Informações da Conta */}
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/60 dark:bg-muted/30 px-2 py-1 rounded">
                        <Building2 className="h-3 w-3 shrink-0 text-primary" />
                        <span className="font-medium text-foreground truncate max-w-[200px]">
                          {item.supplierName}
                        </span>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>

                      {/* Texto do Comentário */}
                      <div className="mt-2 text-xs text-foreground bg-background/80 p-2 rounded border border-border/50">
                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {item.text}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                        <span className="flex items-center gap-1 hover:underline">
                          <ExternalLink className="h-3 w-3" />
                          Clique para ver a conta e responder
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {pendingMentions.length > 0 && (
            <div className="border-t pt-3 flex items-center justify-between gap-2 shrink-0">
              {unreadCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await markAllAsRead();
                  }}
                  className="h-8 text-xs gap-1.5"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Marcar todas como lidas
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="h-8 text-xs"
              >
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Comentários Aberta ao Clicar na Menção */}
      {selectedTransaction && (
        <TransactionCommentsDialog
          open={!!selectedTransaction}
          onOpenChange={(open) => !open && setSelectedTransaction(null)}
          transaction={selectedTransaction}
          canWrite={canWrite}
        />
      )}
    </>
  );
}
