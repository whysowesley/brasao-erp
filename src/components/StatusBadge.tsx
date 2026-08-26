import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type StockStatus } from "@/lib/inventory";
import { cn } from "@/lib/utils";

const styles: Record<StockStatus, string> = {
  critico: "bg-critical/12 text-critical border-critical/30",
  atencao: "bg-warning/15 text-warning-foreground border-warning/40",
  normal: "bg-success/12 text-success border-success/30",
};

const dot: Record<StockStatus, string> = {
  critico: "bg-critical",
  atencao: "bg-warning",
  normal: "bg-success",
};

export function StatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", styles[status], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status])} />
      {STATUS_LABEL[status]}
    </Badge>
  );
}
