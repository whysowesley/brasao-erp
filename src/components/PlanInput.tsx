import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export interface PlanInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}

/**
 * Campo numérico com suporte total a decimais (ex: 3,5 ou 3.5).
 * Mantém o estado textual durante a digitação para não truncar a vírgula/ponto antes do próximo dígito.
 */
export function PlanInput({ value, onChange, className, placeholder }: PlanInputProps) {
  const [text, setText] = useState<string>(() =>
    value !== undefined && value !== null ? String(value) : "0",
  );

  useEffect(() => {
    const currentParsed = Number(text.replace(",", "."));
    // Só atualiza externamente se for diferente e o usuário não estiver terminando de digitar vírgula ou ponto
    if (currentParsed !== value && !text.endsWith(",") && !text.endsWith(".")) {
      setText(value !== undefined && value !== null ? String(value) : "0");
    }
  }, [value, text]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const val = e.target.value;
        // Permite números vazios ou com uma vírgula/ponto
        if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === "") {
          setText(val);
          if (val !== "" && !val.endsWith(",") && !val.endsWith(".")) {
            const parsed = Number(val.replace(",", "."));
            if (Number.isFinite(parsed)) {
              onChange(parsed);
            }
          }
        }
      }}
      onBlur={() => {
        if (text === "" || text === "," || text === ".") {
          setText("0");
          onChange(0);
          return;
        }
        const parsed = Number(text.replace(",", "."));
        if (Number.isFinite(parsed)) {
          setText(String(parsed));
          onChange(parsed);
        } else {
          setText("0");
          onChange(0);
        }
      }}
      className={className}
    />
  );
}
