import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardVariant = "default" | "success" | "danger" | "warning" | "info" | "primary";
export type StatCardIconType =
  "saldo" | "receita" | "despesa" | "atrasado" | "pendente" | "previsto" | "moeda";

export interface FinanceiroStatCardProps {
  title: string;
  value: number | string;
  subtitle?: string | undefined;
  variant?: StatCardVariant | undefined;
  iconType?: StatCardIconType | undefined;
  badge?: string | undefined;
  className?: string | undefined;
  onClick?: (() => void) | undefined;
}

export function FinanceiroStatCard({
  title,
  value,
  subtitle,
  variant = "default",
  iconType = "moeda",
  badge,
  className,
  onClick,
}: FinanceiroStatCardProps) {
  const formattedValue =
    typeof value === "number"
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value)
      : value;

  const variantStyles = {
    default: {
      card: "border-border bg-card hover:border-primary/30",
      iconBg: "bg-muted text-muted-foreground",
      valueColor: "text-foreground",
    },
    success: {
      card: "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      valueColor: "text-emerald-600 dark:text-emerald-400",
    },
    danger: {
      card: "border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40",
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      valueColor: "text-rose-600 dark:text-rose-400",
    },
    warning: {
      card: "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      valueColor: "text-amber-600 dark:text-amber-400",
    },
    info: {
      card: "border-sky-500/20 bg-sky-500/5 hover:border-sky-500/40",
      iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      valueColor: "text-sky-600 dark:text-sky-400",
    },
    primary: {
      card: "border-primary/20 bg-primary/5 hover:border-primary/40",
      iconBg: "bg-primary/10 text-primary",
      valueColor: "text-foreground",
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.default;

  const renderIcon = () => {
    switch (iconType) {
      case "saldo":
        return <Wallet className="h-5 w-5" />;
      case "receita":
        return <ArrowUpRight className="h-5 w-5 text-emerald-500" />;
      case "despesa":
        return <ArrowDownRight className="h-5 w-5 text-rose-500" />;
      case "atrasado":
        return <AlertCircle className="h-5 w-5 text-rose-500" />;
      case "pendente":
        return <Clock className="h-5 w-5 text-amber-500" />;
      case "previsto":
        return <TrendingUp className="h-5 w-5 text-primary" />;
      case "moeda":
      default:
        return <DollarSign className="h-5 w-5" />;
    }
  };

  return (
    <Card
      id={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        currentVariant.card,
        onClick && "cursor-pointer active:scale-[0.99]",
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg shadow-xs",
              currentVariant.iconBg,
            )}
          >
            {renderIcon()}
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2">
          <h3 className={cn("text-2xl font-bold tracking-tight", currentVariant.valueColor)}>
            {formattedValue}
          </h3>
          {badge && (
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {badge}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
