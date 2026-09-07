import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type HoleriteData } from "@/lib/holerites";
import { HoleriteA4Sheet } from "./HoleriteA4Sheet";

interface HoleriteViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: HoleriteData | null;
}

export const HoleriteViewModal: React.FC<HoleriteViewModalProps> = ({
  open,
  onOpenChange,
  data,
}) => {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-4 overflow-y-auto">
        <DialogHeader className="print:hidden pb-2 border-b">
          <DialogTitle className="text-base font-bold flex items-center justify-between">
            <span>
              Visualização do Holerite — {data.employee_name} ({data.reference_month})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <HoleriteA4Sheet data={data} onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
