import { StrictMode, createElement, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

// O Firebase Hosting entrega uma casca estática. A interface é montada integralmente
// no navegador para evitar divergências de hidratação entre a casca e a rota atual.
startTransition(() => {
  createRoot(document).render(createElement(StrictMode, null, createElement(StartClient)));
});
