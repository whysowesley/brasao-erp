import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrasaoLogo } from "@/components/BrasaoLogo";
import { useBranding } from "@/lib/branding";
import {
  getInitialSessionAuth,
  signInWithGoogleAuth,
  signInWithPasswordAuth,
  signUpWithPasswordAuth,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Brasão Estoque e Compras" },
      {
        name: "description",
        content:
          "Acesse o sistema interno da Galeteria Brasão para controle de estoque, compras e fornecedores.",
      },
      { property: "og:title", content: "Entrar | Brasão Estoque e Compras" },
      {
        property: "og:description",
        content: "Login do sistema interno de estoque e compras da Galeteria Brasão.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getInitialSessionAuth().then((session) => {
      if (session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error, friendlyMessage } = await signInWithPasswordAuth(email, password);
    setLoading(false);
    if (error) {
      toast.error(friendlyMessage || error.message);
      return;
    }
    navigate({ to: "/", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error, friendlyMessage } = await signUpWithPasswordAuth(email, password, name);
    setLoading(false);
    if (error) {
      toast.error(friendlyMessage || error.message);
      return;
    }
    if (data?.session) {
      navigate({ to: "/", replace: true });
    } else {
      toast.success("Cadastro criado com sucesso. Aguarde a aprovação do administrador.");
    }
  }

  async function google() {
    setLoading(true);
    const { error, friendlyMessage } = await signInWithGoogleAuth();
    setLoading(false);
    if (error) {
      toast.error(friendlyMessage || error.message);
      return;
    }
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrasaoLogo size="hero" customSrc="/brasao-logo.jpeg" className="mb-1" />
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight text-foreground">
              {branding.companyName || "Galeteria Brasão"}
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              {branding.subtitle || "Controle de Estoque, Compras & Financeiro"}
            </p>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={google}>
          Entrar com Google
        </Button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form className="space-y-3" onSubmit={signIn}>
              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Entrar
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form className="space-y-3" onSubmit={signUp}>
              <div className="space-y-1">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email2">E-mail</Label>
                <Input
                  id="email2"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password2">Senha</Label>
                <Input
                  id="password2"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Criar conta
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Novas contas entram como visualizador e precisam ser liberadas pelo administrador.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
