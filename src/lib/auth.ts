import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/config";

export type AppRole = "master" | "manager" | "operator" | "viewer" | "editor";

export interface UserProfile {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  approved: boolean;
  role: AppRole;
  createdAt?: string | null;
}

export interface UserProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  approved: boolean;
  created_at: string;
  role: AppRole;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  master: "Master (Acesso Total)",
  manager: "Gerente",
  operator: "Operador",
  editor: "Editor",
  viewer: "Visualizador",
};

export const OWNER_EMAIL = "wesleyjunio197@gmail.com";

export function isOwnerUser(user: FirebaseUser | null | undefined): boolean {
  if (!user || !user.email) return false;
  return user.email.trim().toLowerCase() === OWNER_EMAIL;
}

export function getFriendlyAuthErrorMessage(
  error: unknown,
  context: "login" | "signup" | "google" = "login",
): string {
  if (!error) return "Ocorreu um erro desconhecido na autenticação.";

  const err = error as { code?: string; message?: string };
  const code = err.code || "";
  const message = err.message || "";

  switch (code) {
    case "auth/operation-not-allowed":
      if (context === "google") {
        return "O login com Google está desativado no Firebase. Ative o provedor Google no Console do Firebase (Authentication > Sign-in method).";
      }
      return "Login por E-mail e Senha está desativado no Firebase. Ative este provedor no Console do Firebase (Authentication > Sign-in method).";

    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.";

    case "auth/email-already-in-use":
      return "Este e-mail já está cadastrado. Faça login na aba 'Entrar' ou recupere sua senha.";

    case "auth/weak-password":
      return "A senha é muito fraca. Utilize pelo menos 6 caracteres com números ou símbolos.";

    case "auth/too-many-requests":
      return "Muitas tentativas sem sucesso. Por segurança, aguarde alguns instantes antes de tentar novamente.";

    case "auth/popup-closed-by-user":
      return "A janela de login com Google foi fechada antes de concluir a autenticação.";

    case "auth/popup-blocked":
      return "A janela pop-up de login foi bloqueada pelo navegador. Permita pop-ups para este site e tente novamente.";

    case "auth/account-exists-with-different-credential":
      return "Já existe uma conta associada a este e-mail utilizando outro método de autenticação.";

    case "auth/invalid-email":
      return "O endereço de e-mail informado possui formato inválido.";

    case "auth/network-request-failed":
      return "Erro de conexão com o Firebase. Verifique sua conexão de rede e tente novamente.";

    case "auth/unauthorized-domain":
      return "Este domínio não está autorizado no Firebase Authentication (Console > Authentication > Settings > Authorized domains).";

    case "auth/user-disabled":
      return "Esta conta foi desativada pelo administrador no Firebase.";

    default:
      if (message.includes("operation-not-allowed")) {
        return context === "google"
          ? "O login com Google está desativado no Firebase. Ative o provedor Google no Console do Firebase (Authentication > Sign-in method)."
          : "Login por E-mail e Senha está desativado no Firebase. Ative este provedor no Console do Firebase (Authentication > Sign-in method).";
      }
      return message || "Erro ao processar autenticação no Firebase.";
  }
}

let authUserPromise: Promise<FirebaseUser | null> | null = null;
export function getAuthUserPromise(): Promise<FirebaseUser | null> {
  if (!authUserPromise) {
    authUserPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user);
        },
        () => {
          unsubscribe();
          resolve(null);
        },
      );
    });
  }
  return authUserPromise;
}

export async function getCurrentAuthUser(): Promise<FirebaseUser | null> {
  const user = auth.currentUser || (await getAuthUserPromise());
  return user;
}

export async function getInitialSessionAuth(): Promise<FirebaseUser | null> {
  return getCurrentAuthUser();
}

export async function signInWithPasswordAuth(email: string, pass: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    const userDocRef = doc(db, "users", user.uid);
    try {
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        const isMasterOwner = isOwnerUser(user);
        const role: AppRole = "master";
        const approved = isMasterOwner;

        await setDoc(userDocRef, {
          email: user.email || "",
          fullName: user.displayName || user.email?.split("@")[0] || "Usuário",
          role,
          approved,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (docErr) {
      console.warn("User doc sync skipped on sign in:", docErr);
    }

    return { data: cred, error: null, friendlyMessage: null };
  } catch (err: unknown) {
    const friendlyMessage = getFriendlyAuthErrorMessage(err, "login");
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
      friendlyMessage,
    };
  }
}

export async function signUpWithPasswordAuth(email: string, pass: string, fullName?: string) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    const isMasterOwner = isOwnerUser(user);
    // Quem for autenticado e aprovado terá acesso master
    const role: AppRole = "master";
    const approved = isMasterOwner;

    try {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email || "",
        fullName: fullName || user.email?.split("@")[0] || "Usuário",
        role,
        approved,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (docErr) {
      console.warn("User doc creation skipped on sign up:", docErr);
    }

    return {
      data: {
        user,
        approved,
        session: true,
      },
      error: null,
      friendlyMessage: null,
    };
  } catch (err: unknown) {
    const friendlyMessage = getFriendlyAuthErrorMessage(err, "signup");
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
      friendlyMessage,
    };
  }
}

export async function signInWithGoogleAuth() {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;

    const userDocRef = doc(db, "users", user.uid);
    try {
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        const isMasterOwner = isOwnerUser(user);
        const role: AppRole = "master";
        const approved = isMasterOwner;

        await setDoc(userDocRef, {
          email: user.email || "",
          fullName: user.displayName || user.email?.split("@")[0] || "Usuário",
          avatarUrl: user.photoURL || null,
          role,
          approved,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (docErr) {
      console.warn("User doc sync skipped on google sign in:", docErr);
    }

    return { data: cred, error: null, friendlyMessage: null };
  } catch (err: unknown) {
    const friendlyMessage = getFriendlyAuthErrorMessage(err, "google");
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
      friendlyMessage,
    };
  }
}

export async function signOutAuth() {
  await firebaseSignOut(auth);
}

export function useMe() {
  return useQuery({
    queryKey: ["auth_profile"],
    queryFn: async (): Promise<UserProfile | null> => {
      const user = await getCurrentAuthUser();
      if (!user) return null;

      const isMasterOwner = isOwnerUser(user);

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const data = userSnap.data() as Record<string, unknown>;
          const role = isMasterOwner ? "master" : (data["role"] as AppRole) || "master";
          const approved = isMasterOwner ? true : Boolean(data["approved"]);

          return {
            userId: user.uid,
            email: (data["email"] as string) || user.email || "",
            fullName:
              (data["fullName"] as string) ||
              (data["full_name"] as string) ||
              user.displayName ||
              user.email ||
              "",
            avatarUrl:
              (data["avatarUrl"] as string) ||
              (data["avatar_url"] as string) ||
              user.photoURL ||
              null,
            approved,
            role,
          };
        }

        const initialRole: AppRole = "master";
        const isApproved = isMasterOwner;

        const newProfileData = {
          email: user.email || "",
          fullName: user.displayName || user.email?.split("@")[0] || "Usuário",
          role: initialRole,
          approved: isApproved,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        try {
          await setDoc(userDocRef, newProfileData);
        } catch {
          // ignore rules delay
        }

        return {
          userId: user.uid,
          email: user.email || "",
          fullName: newProfileData.fullName,
          avatarUrl: user.photoURL || null,
          approved: isApproved,
          role: initialRole,
        };
      } catch (err) {
        console.error("Erro ao carregar perfil do Firestore:", err);
        return {
          userId: user.uid,
          email: user.email || "",
          fullName: user.displayName || user.email || "Usuário",
          avatarUrl: user.photoURL || null,
          approved: isMasterOwner,
          role: (isMasterOwner ? "master" : "viewer") as AppRole,
        };
      }
    },
    staleTime: 1000 * 30, // 30s cache for fast approval detection
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useMe();

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await signOutAuth();
    },
    onSuccess: () => {
      queryClient.setQueryData(["auth_profile"], null);
      queryClient.clear();
      window.location.href = "/auth";
    },
  });

  const isAuthenticated = !!profile && !!auth.currentUser;
  const isApproved = profile ? profile.approved : false;
  const role = profile ? profile.role : null;
  const isMaster = role === "master" || isOwnerUser(auth.currentUser);
  const isManager = role === "manager" || isMaster;
  const canWrite = isApproved && (role === "operator" || role === "editor" || isManager);

  return {
    user: profile,
    profile,
    isLoading: isProfileLoading,
    isAuthenticated,
    isApproved,
    role,
    isMaster,
    isManager,
    canWrite,
    signOut: signOutMutation.mutate,
    isSigningOut: signOutMutation.isPending,
    refetchProfile,
  };
}

export function useCanWrite(): boolean {
  const { data: me } = useMe();
  if (!me) return false;
  if (!me.approved) return false;
  return (
    me.role === "master" || me.role === "manager" || me.role === "operator" || me.role === "editor"
  );
}

export async function fetchUsersList(): Promise<UserProfileRow[]> {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => {
      const d = docSnap.data() as Record<string, unknown>;
      const createdDate = (d["createdAt"] as { toDate?: () => Date })?.toDate
        ? (d["createdAt"] as { toDate: () => Date }).toDate().toISOString()
        : (d["created_at"] as string) || new Date().toISOString();
      return {
        id: docSnap.id,
        email: (d["email"] as string) ?? null,
        full_name: (d["fullName"] as string) || (d["full_name"] as string) || null,
        approved: Boolean(d["approved"]),
        created_at: createdDate,
        role: (d["role"] as AppRole) || "master",
      };
    });
  } catch {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((docSnap) => {
      const d = docSnap.data() as Record<string, unknown>;
      const createdDate = (d["createdAt"] as { toDate?: () => Date })?.toDate
        ? (d["createdAt"] as { toDate: () => Date }).toDate().toISOString()
        : (d["created_at"] as string) || new Date().toISOString();
      return {
        id: docSnap.id,
        email: (d["email"] as string) ?? null,
        full_name: (d["fullName"] as string) || (d["full_name"] as string) || null,
        approved: Boolean(d["approved"]),
        created_at: createdDate,
        role: (d["role"] as AppRole) || "master",
      };
    });
  }
}

export async function setUserApproval(userId: string, approved: boolean) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    approved,
    role: "master",
    updatedAt: serverTimestamp(),
  });
}

export async function setUserRole(userId: string, role: AppRole) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    role,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteUserProfile(userId: string) {
  const userRef = doc(db, "users", userId);
  await deleteDoc(userRef);
}
