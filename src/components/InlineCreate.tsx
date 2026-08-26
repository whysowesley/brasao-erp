import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Botão "+" que abre um mini formulário para criar um cadastro rápido. */
export function InlineCreate({
  title,
  placeholder,
  extraPlaceholder,
  onCreate,
}: {
  title: string;
  placeholder: string;
  /** Quando definido, exibe um segundo campo (ex.: nome da unidade). */
  extraPlaceholder?: string;
  onCreate: (value: string, extra: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onCreate(value.trim(), extra.trim());
      setValue("");
      setExtra("");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        title={title}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              autoFocus
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !extraPlaceholder) submit();
              }}
            />
            {extraPlaceholder && (
              <Input
                placeholder={extraPlaceholder}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving || !value.trim()}>
              {saving ? "Salvando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
