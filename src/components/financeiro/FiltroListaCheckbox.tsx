import React, { useState, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface FilterListItem {
  id: string;
  name: string;
  color?: string | null;
  count?: number;
}

interface FiltroListaCheckboxProps {
  title: string;
  icon?: React.ReactNode;
  items: FilterListItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

export function FiltroListaCheckbox({
  title,
  icon,
  items,
  selectedIds,
  onSelectionChange,
  placeholder = "Buscar...",
  allLabel = "Todas",
  className = "",
}: FiltroListaCheckboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const s = searchTerm.toLowerCase().trim();
    return items.filter((item) => item.name.toLowerCase().includes(s));
  }, [items, searchTerm]);

  const hasSelection = selectedIds.length > 0;
  const isAllSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    const allIds = items.map((i) => i.id);
    onSelectionChange(allIds);
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 text-xs font-medium justify-between gap-1.5 transition-all ${
            hasSelection
              ? "border-primary bg-primary/10 text-primary hover:bg-primary/15 font-semibold"
              : "border-border/80 bg-background text-foreground hover:bg-muted"
          } ${className}`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {icon}
            <span>{title}</span>
            {hasSelection ? (
              <Badge
                variant="secondary"
                className="h-4.5 px-1.5 text-[10px] bg-primary text-primary-foreground font-semibold rounded-full"
              >
                {selectedIds.length}
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground font-normal">({allLabel})</span>
            )}
          </div>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60 ml-0.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[280px] p-2 shadow-lg border-border">
        <div className="space-y-2">
          {/* Topo do Popover */}
          <div className="flex items-center justify-between px-1 pb-1 border-b border-border/60">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              {icon}
              {title}
            </span>
            {hasSelection && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-0.5 font-medium transition-colors"
              >
                <X className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="h-7.5 pl-8 text-xs bg-muted/30"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Ações Rápidas: Marcar Todos / Limpar */}
          <div className="flex items-center justify-between px-1 text-[11px]">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={isAllSelected}
              className="text-primary hover:underline font-medium disabled:opacity-40 disabled:no-underline cursor-pointer"
            >
              Marcar todos
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!hasSelection}
              className="text-muted-foreground hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
            >
              Desmarcar todos
            </button>
          </div>

          {/* Lista com Checkboxes */}
          <ScrollArea className="h-56 pr-1">
            <div className="space-y-1">
              {filteredItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Nenhum item encontrado.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isChecked = selectedIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors ${
                        isChecked
                          ? "bg-primary/10 text-primary font-semibold"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        />
                        {item.color && (
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                        )}
                        <span className="truncate">{item.name}</span>
                      </div>

                      {typeof item.count === "number" && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                            isChecked
                              ? "bg-primary text-primary-foreground font-bold"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Rodapé informativo */}
          <div className="border-t border-border/60 pt-1.5 px-1 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>
              {hasSelection
                ? `${selectedIds.length} de ${items.length} marcado(s)`
                : `Exibindo ${allLabel.toLowerCase()}`}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-[11px] px-2"
              onClick={() => setOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
