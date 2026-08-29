import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  ShoppingCart,
  FileText,
  Truck,
  History,
  Settings,
  Upload,
  Users,
  LogOut,
  Landmark,
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Calendar,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";

import { BrasaoLogo } from "@/components/BrasaoLogo";
import { useBranding } from "@/lib/branding";
import { ROLE_LABEL, signOutAuth, useMe } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const operacaoItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Produtos", url: "/estoque", icon: Boxes },
  { title: "Contagens", url: "/contagens", icon: ClipboardList },
  { title: "Sugestões de Compra", url: "/sugestoes", icon: ShoppingCart },
  { title: "Pedidos de Compra", url: "/pedidos", icon: FileText },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
  { title: "Histórico", url: "/historico", icon: History },
];

const financeiroItems = [
  { title: "Dashboard Financeiro", url: "/financeiro", icon: Landmark },
  { title: "Fluxo de Caixa", url: "/financeiro/lancamentos", icon: ArrowLeftRight },
  { title: "Contas a Pagar", url: "/financeiro/contas-pagar", icon: TrendingDown },
  { title: "Contas a Receber", url: "/financeiro/contas-receber", icon: TrendingUp },
  { title: "Visão Mensal", url: "/financeiro/meses", icon: Calendar },
  { title: "Relatórios / DRE", url: "/financeiro/relatorios", icon: FileSpreadsheet },
];

const secondary = [
  { title: "Importar", url: "/importar", icon: Upload },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { branding } = useBranding();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    if (url === "/financeiro") return pathname === "/financeiro" || pathname === "/financeiro/";
    return pathname === url || pathname.startsWith(url + "/");
  };
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const systemItems: Array<{ title: string; url: string; icon: LucideIcon }> = [
    { title: "Importar", url: "/importar", icon: Upload },
    ...(me?.role === "master" ? [{ title: "Usuários", url: "/usuarios", icon: Users }] : []),
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ];

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await signOutAuth();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60 bg-sidebar px-3 py-3.5">
        <div className="flex items-center gap-3">
          <BrasaoLogo size="md" className="shrink-0" />
          {!collapsed && (
            <div className="leading-tight">
              <p className="font-serif text-sm font-bold tracking-wide text-sidebar-foreground truncate max-w-[170px]">
                {branding.companyName || "Galeteria Brasão"}
              </p>
              <p className="text-[11px] font-medium text-sidebar-foreground/70 truncate max-w-[170px]">
                {branding.subtitle || "Estoque & Financeiro"}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Operação */}
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operacaoItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Financeiro */}
        <SidebarGroup>
          <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeiroItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sistema */}
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {me && (
        <SidebarFooter className="border-t border-sidebar-border">
          {!collapsed && (
            <div className="px-2 pb-1">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{me.fullName}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">
                {ROLE_LABEL[me.role]}
                {!me.approved && " · aguardando liberação"}
              </p>
            </div>
          )}
          <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
