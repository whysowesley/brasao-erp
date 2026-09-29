import { useState, useRef } from "react";
import {
  MessageSquare,
  AtSign,
  Send,
  Trash2,
  User,
  Clock,
  Building2,
  Check,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, useUsersList } from "@/lib/auth";
import { useAddTransactionComment, useDeleteTransactionComment } from "@/lib/financeiro";
import type { FinancialTransaction, TransactionComment } from "@/lib/financeiro-types";
import { cn } from "@/lib/utils";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function formatCommentDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

interface TransactionCommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: FinancialTransaction | null;
  canWrite: boolean;
}

export function TransactionCommentsDialog({
  open,
  onOpenChange,
  transaction,
  canWrite,
}: TransactionCommentsDialogProps) {
  const { user, isMaster } = useAuth();
  const { data: users = [] } = useUsersList();
  const addCommentMutation = useAddTransactionComment();
  const deleteCommentMutation = useDeleteTransactionComment();

  const [commentText, setCommentText] = useState("");
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!transaction) return null;

  const comments = transaction.comments || [];

  // Filtra apenas usuários aprovados
  const approvedUsers = users.filter((u) => u.approved !== false);
  const filteredUsers = approvedUsers.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(mentionSearch.toLowerCase()),
  );

  const handleInsertMention = (targetUser: (typeof approvedUsers)[0]) => {
    const nameToInsert = targetUser.full_name || targetUser.email?.split("@")[0] || "Usuario";
    const mentionTag = `@${nameToInsert} `;

    // Insere no cursor ou ao final
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart || commentText.length;
      const end = textareaRef.current.selectionEnd || commentText.length;
      const nextText = commentText.substring(0, start) + mentionTag + commentText.substring(end);
      setCommentText(nextText);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            start + mentionTag.length,
            start + mentionTag.length,
          );
        }
      }, 50);
    } else {
      setCommentText((prev) => prev + mentionTag);
    }

    setMentionPopoverOpen(false);
    setMentionSearch("");
  };

  const handleSendComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanText = commentText.trim();
    if (!cleanText) return;

    if (!user) {
      toast.error("Você precisa estar logado para comentar.");
      return;
    }

    // Extrai menções (@Nome)
    const mentionMatches = cleanText.match(/@([\wÀ-ÿ-]+)/g) || [];
    const mentions = mentionMatches.map((m) => m.replace("@", "").trim());

    // Resolve os IDs dos usuários correspondentes às menções
    const mentionedUserIds: string[] = [];
    mentions.forEach((mention) => {
      const match = approvedUsers.find((u) => {
        const name = (u.full_name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const emailPrefix = (u.email?.split("@")[0] || "").toLowerCase();
        const target = mention.toLowerCase();
        return (
          name === target ||
          name.includes(target) ||
          email === target ||
          emailPrefix === target ||
          u.id === mention
        );
      });
      if (match && match.id && !mentionedUserIds.includes(match.id)) {
        mentionedUserIds.push(match.id);
      }
    });

    const currentUserId = user.userId || (user as { uid?: string }).uid || "usuario";
    const currentUserName = user.fullName || user.email?.split("@")[0] || "Usuário";
    const currentUserEmail = user.email || null;

    try {
      await addCommentMutation.mutateAsync({
        transactionId: transaction.id,
        text: cleanText,
        mentions,
        mentionedUserIds,
        user: {
          id: currentUserId,
          name: currentUserName,
          email: currentUserEmail,
        },
      });

      setCommentText("");
      if (mentions.length > 0) {
        toast.success(`Comentário enviado! Usuário(s) mencionado(s): ${mentions.join(", ")}`);
      } else {
        toast.success("Comentário adicionado com sucesso!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar comentário.";
      toast.error(msg);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteCommentMutation.mutateAsync({
        transactionId: transaction.id,
        commentId,
      });
      toast.success("Comentário excluído.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir comentário.";
      toast.error(msg);
    }
  };

  // Renderiza texto destacando @menções em azul
  const renderCommentBody = (text: string) => {
    const parts = text.split(/(@[\wÀ-ÿ-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mx-0.5"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-4 sm:p-6 bg-background flex flex-col max-h-[90vh]">
        <DialogHeader className="space-y-1.5 border-b pb-3 text-left shrink-0">
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Comentários & Menções
              <Badge variant="secondary" className="text-xs">
                {comments.length}
              </Badge>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              {transaction.supplier_name || transaction.description || "Lançamento"}
            </span>
            <span>•</span>
            <span className="font-bold text-foreground">{formatCurrency(transaction.amount)}</span>
            <span>•</span>
            <span>Vencimento: {transaction.due_date}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Lista de Comentários */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-[160px] max-h-[400px] pr-1">
          {comments.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground space-y-2">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p>Nenhum comentário registrado nesta conta.</p>
              <p className="text-[11px]">
                Deixe anotações, combinados ou marque um usuário com <strong>@nome</strong>.
              </p>
            </div>
          ) : (
            comments.map((c) => {
              const currentUserId = user?.userId || (user as { uid?: string })?.uid;
              const isAuthor = Boolean(currentUserId && currentUserId === c.user_id);
              const canDelete = isAuthor || isMaster;

              return (
                <div
                  key={c.id}
                  className="rounded-lg border bg-muted/25 p-3 space-y-1.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                        {c.user_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-foreground">{c.user_name}</span>
                      {c.user_email && (
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">
                          ({c.user_email})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatCommentDate(c.created_at)}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-muted-foreground/60 hover:text-destructive p-1 rounded transition-colors"
                          title="Excluir comentário"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap pl-7">
                    {renderCommentBody(c.text)}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Formulário para Novo Comentário */}
        <form onSubmit={handleSendComment} className="border-t pt-3 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">Novo Comentário:</span>

            {/* Popover de Menção (@) */}
            <Popover open={mentionPopoverOpen} onOpenChange={setMentionPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/40"
                >
                  <AtSign className="h-3.5 w-3.5" />
                  <span>Mencionar Usuário</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 space-y-2" align="end">
                <div className="flex items-center gap-1.5 px-1 border-b pb-1.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={mentionSearch}
                    onChange={(e) => setMentionSearch(e.target.value)}
                    placeholder="Filtrar usuário..."
                    className="h-7 text-xs border-none shadow-none focus-visible:ring-0 p-0"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-2">
                      Nenhum usuário encontrado.
                    </p>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleInsertMention(u)}
                        className="w-full text-left p-1.5 rounded hover:bg-muted text-xs flex items-center justify-between gap-2 transition-colors"
                      >
                        <div className="truncate">
                          <p className="font-semibold truncate">
                            {u.full_name || u.email?.split("@")[0] || "Usuário"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase shrink-0">
                          {u.role}
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Escreva seu comentário... Dica: clique em 'Mencionar Usuário' para marcar alguém com @"
            rows={3}
            className="text-xs resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendComment();
              }
            }}
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Pressione Ctrl+Enter para enviar
            </span>
            <Button
              type="submit"
              disabled={!commentText.trim() || addCommentMutation.isPending}
              size="sm"
              className="h-8 text-xs gap-1.5 ml-auto bg-primary text-primary-foreground font-semibold"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enviar Comentário</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
