import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export interface PlanInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  /** Se deve forçar arredondamento para cima em números inteiros (padrão true para compras) */
  roundUp?: boolean;
}

/**
 * Campo numérico para planejamento de compras ("Quero Comprar").
 * Mantém valores arredondados para cima conforme regra operacional da Brasão,
 * persiste estado com segurança e não perde dados ao navegar entre telas ou no mobile.
 */
export function PlanInput({
  value,
  onChange,
  className,
  placeholder,
  roundUp = true,
}: PlanInputProps) {
  const isFocusedRef = useRef(false);

  // Garante que o valor numérico inicial exibido seja arredondado para cima se > 0
  const effectiveInitial =
    value !== undefined && value !== null ? (roundUp && value > 0 ? Math.ceil(value) : value) : 0;

  const [text, setText] = useState<string>(() => String(effectiveInitial));

  const textRef = useRef(text);
  textRef.current = text;
  const valueRef = useRef(effectiveInitial);
  valueRef.current = effectiveInitial;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Quando o valor muda externamente (ex: carregou do localStorage / Firestore),
  // só sincroniza o texto se o usuário não estiver digitando ativamente no campo
  useEffect(() => {
    if (isFocusedRef.current) return;

    const targetVal =
      value !== undefined && value !== null ? (roundUp && value > 0 ? Math.ceil(value) : value) : 0;

    const currentParsed = Number(textRef.current.replace(",", "."));
    if (currentParsed !== targetVal) {
      setText(String(targetVal));
    }
  }, [value, roundUp]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={text}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        const val = e.target.value;
        // Permite dígitos ou vírgula/ponto
        if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === "") {
          setText(val);
          if (val !== "" && !val.endsWith(",") && !val.endsWith(".")) {
            const parsed = Number(val.replace(",", "."));
            if (Number.isFinite(parsed)) {
              const finalVal = roundUp && parsed > 0 ? Math.ceil(parsed) : Math.max(0, parsed);
              onChange(finalVal);
            }
          }
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        if (text === "" || text === "," || text === ".") {
          setText("0");
          onChange(0);
          return;
        }
        const parsed = Number(text.replace(",", "."));
        if (Number.isFinite(parsed)) {
          const finalVal = roundUp && parsed > 0 ? Math.ceil(parsed) : Math.max(0, parsed);
          setText(String(finalVal));
          onChange(finalVal);
        } else {
          setText("0");
          onChange(0);
        }
      }}
      className={className}
    />
  );
}
