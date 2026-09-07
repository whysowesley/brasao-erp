import React from "react";
import { type HoleriteData, formatBrlCurrency, formatBrlCurrencyWithZero } from "@/lib/holerites";

interface HoleriteReceiptProps {
  data: HoleriteData;
  copyLabel?: string;
  className?: string;
  id?: string;
}

export const HoleriteReceipt: React.FC<HoleriteReceiptProps> = ({
  data,
  copyLabel = "VIA DO COLABORADOR",
  className = "",
  id,
}) => {
  // Garantir pelo menos 8 a 10 linhas visuais para manter a proporção clássica do print
  const minRows = 8;
  const items = data.items || [];
  const emptyRowsCount = Math.max(0, minRows - items.length);

  return (
    <div
      id={id}
      className={`bg-white text-black font-mono border-2 border-black text-[11px] leading-tight select-none shadow-xs print:shadow-none print:border-black ${className}`}
      style={{
        width: "100%",
        maxWidth: "800px",
        boxSizing: "border-box",
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      {/* Container flex com Conteúdo Principal à esquerda e Coluna de Assinatura à direita */}
      <div className="flex w-full">
        {/* Lado Principal (~87% da largura) */}
        <div className="flex-1 flex flex-col border-r border-black">
          {/* Cabeçalho Empresa e Título do Recibo */}
          <div className="flex items-start justify-between p-2 border-b border-black">
            {/* Empresa e CNPJ */}
            <div className="flex-1">
              <div className="font-bold text-[13px] tracking-tight uppercase">
                {data.company_name || "099 - GBM ALIMENTOS E BEBIDAS LTDA"}
              </div>
              <div className="mt-0.5 text-[12px] font-semibold">
                CNPJ: {data.cnpj || "57.772.207/0001-00"}
              </div>
              {copyLabel && (
                <div className="text-[9px] uppercase font-bold text-neutral-600 mt-0.5 print:text-black">
                  [{copyLabel}]
                </div>
              )}
            </div>

            {/* Título Centralizado */}
            <div className="flex-1 text-center font-sans">
              <div className="text-[15px] font-bold tracking-tight text-neutral-800 print:text-black">
                Recibo de Pagamento de Salário
              </div>
              <div className="text-[13px] font-bold font-mono text-black mt-0.5 uppercase tracking-wider">
                {data.reference_month || "AGOSTO/2026"}
              </div>
            </div>
          </div>

          {/* Dados do Colaborador (Código, Nome, CBO, CPF, etc) */}
          <div className="px-2 py-1.5 border-b border-black bg-white">
            <div className="grid grid-cols-12 gap-1 text-[10px] text-neutral-600 print:text-black">
              <div className="col-span-1">Código</div>
              <div className="col-span-5">Nome do Funcionário</div>
              <div className="col-span-2 text-center">CBO</div>
              <div className="col-span-4 flex justify-between text-[9px]">
                <span>Emp.</span>
                <span>Local</span>
                <span>Depto.</span>
                <span>Setor</span>
                <span>Seção</span>
                <span>Fl.</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-1 items-baseline font-bold text-[12px] text-black mt-0.5">
              <div className="col-span-1 tracking-wider">{data.employee_code || "9016"}</div>
              <div className="col-span-5 uppercase truncate">
                {data.employee_name || "NOME DO FUNCIONÁRIO"}
              </div>
              <div className="col-span-2 text-center uppercase truncate">
                {data.cbo || "GERENTE"}
              </div>
              <div className="col-span-4 flex justify-between text-[11px] font-semibold">
                <span>{data.emp || "01"}</span>
                <span>{data.local || "01"}</span>
                <span>{data.depto || "01"}</span>
                <span>{data.setor || "01"}</span>
                <span>{data.secao || "01"}</span>
                <span>{data.fl || "01"}</span>
              </div>
            </div>

            {/* CPF posicionado abaixo à direita conforme imagem */}
            <div className="flex justify-end mt-1 text-[11px] font-bold">
              <span>CPF: {data.cpf || "111.782.324-50"}</span>
            </div>
          </div>

          {/* Tabela de Rubricas / Itens */}
          <div className="flex flex-col flex-1 border-b border-black">
            {/* Cabeçalho das Colunas */}
            <div className="flex border-b border-black bg-neutral-50 print:bg-white text-[10px] font-sans font-semibold text-neutral-700 print:text-black">
              <div className="w-12 text-center py-1 border-r border-black">Cód.</div>
              <div className="flex-1 px-2 py-1 border-r border-black">Descrição</div>
              <div className="w-20 text-center py-1 border-r border-black">Referência</div>
              <div className="w-24 text-right px-2 py-1 border-r border-black">Proventos</div>
              <div className="w-24 text-right px-2 py-1">Descontos</div>
            </div>

            {/* Linhas de Itens */}
            <div className="flex flex-col min-h-[160px] bg-white text-[11px]">
              {items.map((item, idx) => (
                <div key={idx} className="flex leading-5 hover:bg-neutral-50/50">
                  <div className="w-12 text-center py-0.5 border-r border-black font-semibold">
                    {item.code}
                  </div>
                  <div className="flex-1 px-2 py-0.5 border-r border-black uppercase font-medium truncate">
                    {item.description}
                  </div>
                  <div className="w-20 text-center py-0.5 border-r border-black">
                    {item.reference || ""}
                  </div>
                  <div className="w-24 text-right px-2 py-0.5 border-r border-black tabular-nums font-medium">
                    {formatBrlCurrency(item.earnings)}
                  </div>
                  <div className="w-24 text-right px-2 py-0.5 tabular-nums font-medium">
                    {formatBrlCurrency(item.deductions)}
                  </div>
                </div>
              ))}

              {/* Linhas em branco para preencher espaço vertical idêntico ao modelo */}
              {Array.from({ length: emptyRowsCount }).map((_, i) => (
                <div key={`empty-${i}`} className="flex leading-5">
                  <div className="w-12 border-r border-black">&nbsp;</div>
                  <div className="flex-1 border-r border-black">&nbsp;</div>
                  <div className="w-20 border-r border-black">&nbsp;</div>
                  <div className="w-24 border-r border-black">&nbsp;</div>
                  <div className="w-24">&nbsp;</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé com Totais e Valor Líquido */}
          <div className="flex flex-col bg-white">
            {/* Linha Total de Vencimentos e Total de Descontos */}
            <div className="flex border-b border-black">
              <div className="flex-1 px-2 py-1 flex items-center text-[10px] text-neutral-600 print:text-black">
                {data.notes ? (
                  <span className="truncate">{data.notes}</span>
                ) : (
                  <span>SALÁRIO BASE: R$ {formatBrlCurrencyWithZero(data.total_earnings)}</span>
                )}
              </div>
              <div className="w-48 flex border-l border-black">
                <div className="w-24 border-r border-black text-right px-2 py-1">
                  <div className="text-[8.5px] text-neutral-600 font-sans uppercase">
                    Total de Vencimentos
                  </div>
                  <div className="text-[12px] font-bold tabular-nums">
                    {formatBrlCurrencyWithZero(data.total_earnings)}
                  </div>
                </div>
                <div className="w-24 text-right px-2 py-1">
                  <div className="text-[8.5px] text-neutral-600 font-sans uppercase">
                    Total de Descontos
                  </div>
                  <div className="text-[12px] font-bold tabular-nums">
                    {formatBrlCurrencyWithZero(data.total_deductions)}
                  </div>
                </div>
              </div>
            </div>

            {/* Linha do Valor Líquido com a Seta clássica */}
            <div className="flex items-center justify-end px-2 py-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-neutral-700 print:text-black font-sans">
                  Valor Líquido
                </span>

                {/* Seta vazada clássica do print */}
                <svg
                  width="40"
                  height="16"
                  viewBox="0 0 50 20"
                  className="stroke-black fill-none"
                  strokeWidth="1.5"
                >
                  <polygon points="2,5 34,5 34,1 48,10 34,19 34,15 2,15" />
                </svg>

                <div className="w-28 text-right font-bold text-[14px] tabular-nums tracking-wide">
                  {formatBrlCurrencyWithZero(data.net_salary)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Faixa Vertical Direita: Declaração, Assinatura e Data conforme modelo de referência */}
        <div className="w-24 shrink-0 flex flex-col bg-white relative overflow-hidden select-none">
          <svg
            className="w-full h-full min-h-[260px]"
            viewBox="0 0 82 290"
            preserveAspectRatio="xMidYMid meet"
          >
            <g transform="rotate(-90) translate(-290, 0)">
              {/* Texto de Declaração de Recebimento */}
              <text
                x="145"
                y="24"
                textAnchor="middle"
                fill="#111111"
                fontSize="6.5"
                fontFamily="Arial, sans-serif"
                fontWeight="500"
                letterSpacing="0.25"
              >
                DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO
              </text>

              {/* Linha de Data com traços e barras inclinadas: ___ / ___ / _____ */}
              <line x1="16" y1="56" x2="38" y2="56" stroke="#000000" strokeWidth="1" />
              <line x1="39" y1="60" x2="44" y2="50" stroke="#000000" strokeWidth="1" />
              <line x1="45" y1="56" x2="67" y2="56" stroke="#000000" strokeWidth="1" />
              <line x1="68" y1="60" x2="73" y2="50" stroke="#000000" strokeWidth="1" />
              <line x1="74" y1="56" x2="104" y2="56" stroke="#000000" strokeWidth="1" />

              {/* Rótulo DATA */}
              <text
                x="60"
                y="68"
                textAnchor="middle"
                fill="#333333"
                fontSize="6.5"
                fontFamily="Arial, sans-serif"
                fontWeight="bold"
                letterSpacing="0.4"
              >
                DATA
              </text>

              {/* Linha contínua e espaçosa de Assinatura */}
              <line x1="122" y1="56" x2="276" y2="56" stroke="#000000" strokeWidth="1" />

              {/* Rótulo ASSINATURA DO FUNCIONÁRIO */}
              <text
                x="199"
                y="68"
                textAnchor="middle"
                fill="#333333"
                fontSize="6.5"
                fontFamily="Arial, sans-serif"
                fontWeight="bold"
                letterSpacing="0.4"
              >
                ASSINATURA DO FUNCIONÁRIO
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};
