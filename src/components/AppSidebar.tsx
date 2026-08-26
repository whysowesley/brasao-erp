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
} from "lucide-react";

import logo from "@/assets/brasao-logo.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useMe } from "@/lib/auth";
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

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Estoque", url: "/estoque", icon: Boxes },
  { title: "Contagens", url: "/contagens", icon: ClipboardList },
  { title: "Sugestões de Compra", url: "/sugestoes", icon: ShoppingCart },
  { title: "Pedidos de Compra", url: "/pedidos", icon: FileText },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
  { title: "Histórico", url: "/historico", icon: History },
];

const secondary = [
  { title: "Importar planilha", url: "/importar", icon: Upload },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const systemItems = me?.role === "master"
    ? [...secondary, { title: "Usuários", url: "/usuarios", icon: Users }]
    : secondary;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2">
          <img
            src={logo.url}
            alt="Logo Galeteria Brasão"
            className="h-8 w-8 shrink-0 rounded-md object-contain"
          />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-semibold text-sidebar-foreground">Galeteria Brasão</p>
              <p className="text-[11px] text-sidebar-foreground/60">Estoque & Compras</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
