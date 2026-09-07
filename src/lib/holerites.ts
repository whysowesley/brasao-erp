export interface HoleriteItem {
  code: string;
  description: string;
  reference: string;
  earnings?: number;
  deductions?: number;
}

export interface HoleriteData {
  id: string;
  company_name: string;
  cnpj: string;
  reference_month: string;
  date: string;
  employee_code: string;
  employee_name: string;
  cbo: string;
  cpf: string;
  worked_days: string;
  emp?: string;
  local?: string;
  depto?: string;
  setor?: string;
  secao?: string;
  fl?: string;
  items: HoleriteItem[];
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeData {
  id: string;
  code: string;
  name: string;
  cpf: string;
  cbo: string;
  base_salary?: number;
  active: boolean;
  created_at?: string;
}

export const DEFAULT_COMPANY = {
  name: "099 - GBM ALIMENTOS E BEBIDAS LTDA",
  cnpj: "57.772.207/0001-00",
};

/**
 * Modelo idêntico ao print do usuário
 */
export const SAMPLE_PRINT_HOLERITE: Omit<HoleriteData, "id"> = {
  company_name: "099 - GBM ALIMENTOS E BEBIDAS LTDA",
  cnpj: "57.772.207/0001-00",
  reference_month: "AGOSTO/2026",
  date: "2026-08-31",
  employee_code: "9016",
  employee_name: "ISAULINA OLIVEIRA DA SILVA",
  cbo: "GERENTE",
  cpf: "111.782.324-50",
  worked_days: "3100,00%",
  emp: "",
  local: "",
  depto: "",
  setor: "",
  secao: "",
  fl: "",
  items: [
    {
      code: "02",
      description: "SALARIO CONTRATUAL",
      reference: "3100,00%",
      earnings: 2300.0,
      deductions: 0,
    },
    {
      code: "463",
      description: "VALE TRANSPORTE",
      reference: "6%",
      earnings: 0,
      deductions: 138.0,
    },
    {
      code: "453",
      description: "INSS",
      reference: "",
      earnings: 0,
      deductions: 182.69,
    },
    {
      code: "480",
      description: "DESC. REFEICAO",
      reference: "",
      earnings: 0,
      deductions: 30.0,
    },
    {
      code: "484",
      description: "DESC. VALORES ALIMENTAÇAO",
      reference: "",
      earnings: 0,
      deductions: 160.0,
    },
  ],
  total_earnings: 2300.0,
  total_deductions: 510.69,
  net_salary: 1789.31,
  notes: "",
};

export const COMMON_RUBRICAS = [
  { code: "02", description: "SALARIO CONTRATUAL", type: "earnings", defaultRef: "30d" },
  { code: "10", description: "HORAS EXTRAS 50%", type: "earnings", defaultRef: "" },
  { code: "11", description: "HORAS EXTRAS 100%", type: "earnings", defaultRef: "" },
  { code: "15", description: "D.S.R. S/ HORAS EXTRAS", type: "earnings", defaultRef: "" },
  { code: "20", description: "ADICIONAL NOTURNO", type: "earnings", defaultRef: "20%" },
  { code: "25", description: "INSALUBRIDADE", type: "earnings", defaultRef: "20%" },
  { code: "26", description: "PERICULOSIDADE", type: "earnings", defaultRef: "30%" },
  { code: "453", description: "INSS", type: "deductions", defaultRef: "" },
  { code: "455", description: "I.R.R.F.", type: "deductions", defaultRef: "" },
  { code: "463", description: "VALE TRANSPORTE", type: "deductions", defaultRef: "6%" },
  { code: "480", description: "DESC. REFEICAO", type: "deductions", defaultRef: "" },
  { code: "484", description: "DESC. VALORES ALIMENTAÇAO", type: "deductions", defaultRef: "" },
  { code: "490", description: "ADIANTAMENTO SALARIAL", type: "deductions", defaultRef: "40%" },
  { code: "495", description: "FALTAS / ATRASOS", type: "deductions", defaultRef: "" },
] as const;

export function formatBrlCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value) || value === 0) {
    return "";
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBrlCurrencyWithZero(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return cpf;
}

export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length <= 14) {
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return cnpj;
}

export const MONTHS_PT = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

export function getCurrentReferenceMonth(): string {
  const now = new Date();
  const monthName = MONTHS_PT[now.getMonth()];
  return `${monthName}/${now.getFullYear()}`;
}
