import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Lock, ShieldAlert, UserPlus } from "lucide-react";
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

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou Criar Conta | Brasão Estoque e Compras" },
      {
        name: "description",
        content:
          "Acesse o sistema interno da Galeteria Brasão para controle de estoque, compras e fornecedores.",
      },
      { property: "og:title", content: "Entrar ou Criar Conta | Brasão Estoque e Compras" },
      {
        property: "og:description",
        content: "Login e criação de usuário para o sistema interno da Galeteria Brasão.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredPendingUser, setRegisteredPendingUser] = useState<string | null>(null);

  useEffect(() => {
    getInitialSessionAuth().then((session) => {
      if (session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
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

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas informadas não coincidem. Verifique e tente novamente.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    const { data, error, friendlyMessage } = await signUpWithPasswordAuth(
      email,
      password,
      fullName.trim() || undefined,
    );
    setLoading(false);

    if (error) {
      toast.error(friendlyMessage || error.message);
      return;
    }

    if (data?.approved) {
      toast.success("Conta de administrador criada com sucesso!");
      navigate({ to: "/", replace: true });
    } else {
      setRegisteredPendingUser(email);
      toast.info("Conta cadastrada! Aguardando aprovação do administrador.");
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const { error, friendlyMessage } = await signInWithGoogleAuth();
    setLoading(false);
    if (error) {
      toast.error(friendlyMessage || error.message);
      return;
    }
    navigate({ to: "/", replace: true });
  }

  if (registeredPendingUser) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-card text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-7 w-7" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Cadastro Realizado com Sucesso!
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Aguardando Aprovação do Administrador
          </p>

          <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-50/50 p-4 text-left text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-semibold">
              Usuário registrado:{" "}
              <span className="font-mono text-foreground">{registeredPendingUser}</span>
            </p>
            <p className="mt-2 text-muted-foreground">
              Por segurança, novas contas precisam ser aprovadas manualmente pelo administrador
              master (<strong>Wesley</strong>) na aba de{" "}
              <strong>Configurações &gt; Usuários</strong> antes de acessar os dados do restaurante.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="w-full gap-2"
              onClick={() => {
                setRegisteredPendingUser(null);
                navigate({ to: "/", replace: true });
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Verificar se Já Fui Aprovado
            </Button>
            <Button
              variant="outline"
              className="w-full text-xs"
              onClick={() => {
                setRegisteredPendingUser(null);
                setActiveTab("login");
              }}
            >
              Voltar para a Tela de Entrada
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-card sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrasaoLogo size="hero" customSrc="/brasao-logo.jpeg" className="mb-1" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {branding.companyName || "Galeteria Brasão"}
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              {branding.subtitle || "Controle de Estoque, Compras & Financeiro"}
            </p>
          </div>
        </div>

        {/* Alternador entre Entrar e Criar Conta */}
        <div className="mb-5 grid grid-cols-2 rounded-lg border bg-muted/50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2 font-medium transition-all ${
              activeTab === "login"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("signup")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2 font-medium transition-all ${
              activeTab === "signup"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Criar Conta
          </button>
        </div>

        <Button variant="outline" className="w-full gap-2 text-xs" onClick={handleGoogle}>
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continuar com Google
        </Button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
        </div>

        {activeTab === "login" ? (
          /* Formulário de Login */
          <form className="space-y-3.5" onSubmit={handleSignIn}>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@exemplo.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar no Sistema"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Ainda não tem cadastro?{" "}
              <button
                type="button"
                onClick={() => setActiveTab("signup")}
                className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
              >
                Criar uma conta
              </button>
            </p>
          </form>
        ) : (
          /* Formulário de Cadastro */
          <form className="space-y-3.5" onSubmit={handleSignUp}>
            <div className="space-y-1">
              <Label htmlFor="fullname" className="text-xs">
                Nome Completo
              </Label>
              <Input
                id="fullname"
                type="text"
                placeholder="Seu nome completo"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="signup-email" className="text-xs">
                E-mail
              </Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="seu.email@exemplo.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="signup-password" className="text-xs">
                Senha (mínimo 6 caracteres)
              </Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password" className="text-xs">
                Confirmar Senha
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="rounded-md border border-amber-500/20 bg-amber-50/50 p-2.5 text-[11px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              <ShieldAlert className="inline h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" />
              <strong>Atenção de Segurança:</strong> Ao criar sua conta, seu acesso ficará pendente
              de aprovação pelo administrador master em <em>Configurações &gt; Usuários</em>.
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Cadastrando..." : "Criar Minha Conta"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Já possui conta?{" "}
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
              >
                Fazer login
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
