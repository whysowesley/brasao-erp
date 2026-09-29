import { useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useFinancialTransactions, useMarkMentionAsRead } from "@/lib/financeiro";
import type { FinancialTransaction, TransactionComment } from "@/lib/financeiro-types";

export interface PendingMentionItem {
  id: string; // comment.id
  transactionId: string;
  transaction: FinancialTransaction;
  comment: TransactionComment;
  authorName: string;
  authorEmail?: string | null;
  text: string;
  supplierName: string;
  amount: number;
  dueDate: string;
  createdAt: string;
  isUnread: boolean;
}

export function useUserMentions() {
  const { user } = useAuth();
  const { data: allTransactions = [] } = useFinancialTransactions({ type: "despesa" });
  const markAsReadMutation = useMarkMentionAsRead();

  const currentUserId = user?.userId || (user as { uid?: string })?.uid || "";
  const currentUserName = (user?.fullName || "").toLowerCase().trim();
  const currentUserEmail = (user?.email || "").toLowerCase().trim();
  const emailPrefix = currentUserEmail.split("@")[0] || "";

  // Lê lista local de menções lidas
  const localReadIds = useMemo(() => {
    if (!currentUserId) return new Set<string>();
    try {
      const key = `read_mentions_${currentUserId}`;
      const list: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(list);
    } catch {
      return new Set<string>();
    }
  }, [currentUserId]);

  const pendingMentions = useMemo((): PendingMentionItem[] => {
    if (!currentUserId && !currentUserEmail) return [];

    const result: PendingMentionItem[] = [];

    for (const tx of allTransactions) {
      if (!Array.isArray(tx.comments) || tx.comments.length === 0) continue;

      for (const comment of tx.comments) {
        // Não notifica se o próprio usuário foi quem escreveu o comentário
        const isAuthor =
          (comment.user_id && comment.user_id === currentUserId) ||
          (comment.user_email && comment.user_email.toLowerCase() === currentUserEmail);
        if (isAuthor) continue;

        // Verifica se o usuário atual foi mencionado
        let isMentioned = false;

        // 1. Pelo array de IDs explícitos
        if (
          Array.isArray(comment.mentioned_user_ids) &&
          currentUserId &&
          comment.mentioned_user_ids.includes(currentUserId)
        ) {
          isMentioned = true;
        }

        // 2. Pelo array de strings (@Nome ou @Email)
        if (!isMentioned && Array.isArray(comment.mentions) && comment.mentions.length > 0) {
          isMentioned = comment.mentions.some((m) => {
            const clean = m.toLowerCase().replace("@", "").trim();
            if (!clean) return false;
            return (
              (currentUserName && (currentUserName === clean || currentUserName.includes(clean))) ||
              (currentUserEmail &&
                (currentUserEmail === clean || clean.includes(currentUserEmail))) ||
              (emailPrefix && emailPrefix === clean) ||
              (currentUserId && currentUserId === clean)
            );
          });
        }

        // 3. Pelo texto do comentário diretamente se contiver @Nome
        if (!isMentioned && comment.text) {
          const lowerText = comment.text.toLowerCase();
          if (
            (currentUserName && lowerText.includes(`@${currentUserName}`)) ||
            (emailPrefix && lowerText.includes(`@${emailPrefix}`)) ||
            (currentUserEmail && lowerText.includes(`@${currentUserEmail}`))
          ) {
            isMentioned = true;
          }
        }

        if (!isMentioned) continue;

        // Verifica se já foi lido
        const readInFirestore =
          Array.isArray(comment.read_by) &&
          currentUserId &&
          comment.read_by.includes(currentUserId);
        const readLocally = localReadIds.has(comment.id);
        const isUnread = !readInFirestore && !readLocally;

        result.push({
          id: comment.id,
          transactionId: tx.id,
          transaction: tx,
          comment,
          authorName: comment.user_name || "Usuário",
          authorEmail: comment.user_email,
          text: comment.text,
          supplierName: tx.supplier_name || tx.description || "Lançamento Financeiro",
          amount: tx.amount,
          dueDate: tx.due_date,
          createdAt: comment.created_at,
          isUnread,
        });
      }
    }

    // Ordena da mais recente para a mais antiga
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    allTransactions,
    currentUserId,
    currentUserName,
    currentUserEmail,
    emailPrefix,
    localReadIds,
  ]);

  const unreadMentions = useMemo(
    () => pendingMentions.filter((m) => m.isUnread),
    [pendingMentions],
  );

  const markAsRead = useCallback(
    async (transactionId: string, commentId: string) => {
      if (!currentUserId) return;
      await markAsReadMutation.mutateAsync({
        transactionId,
        commentId,
        userId: currentUserId,
      });
    },
    [currentUserId, markAsReadMutation],
  );

  const markAllAsRead = useCallback(async () => {
    if (!currentUserId) return;
    for (const mention of unreadMentions) {
      await markAsReadMutation.mutateAsync({
        transactionId: mention.transactionId,
        commentId: mention.id,
        userId: currentUserId,
      });
    }
  }, [currentUserId, unreadMentions, markAsReadMutation]);

  return {
    pendingMentions,
    unreadMentions,
    unreadCount: unreadMentions.length,
    totalCount: pendingMentions.length,
    markAsRead,
    markAllAsRead,
  };
}
