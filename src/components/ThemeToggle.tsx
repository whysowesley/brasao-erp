import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            id="header-theme-toggle-btn"
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className={cn(
              "relative h-9 w-9 rounded-lg border border-border/70 bg-background/80 text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground touch-manipulation focus-visible:ring-1 focus-visible:ring-ring",
              className,
            )}
            aria-label={isDark ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
          >
            {/* Sun Icon (Visible in dark mode, smoothly scales and rotates out in light mode) */}
            <Sun
              className={cn(
                "h-4 w-4 text-amber-500 transition-all duration-300",
                isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0 absolute",
              )}
            />

            {/* Moon Icon (Visible in light mode, smoothly scales and rotates out in dark mode) */}
            <Moon
              className={cn(
                "h-4 w-4 text-slate-700 transition-all duration-300",
                !isDark
                  ? "rotate-0 scale-100 opacity-100"
                  : "-rotate-90 scale-0 opacity-0 absolute",
              )}
            />

            <span className="sr-only">
              {isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="text-xs font-medium">
          {isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
