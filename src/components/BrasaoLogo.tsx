import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";

interface BrasaoLogoProps extends HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "hero";
  showText?: boolean;
  className?: string;
  customSrc?: string;
}

export function BrasaoLogo({
  size = "md",
  showText = false,
  className,
  customSrc,
  ...props
}: BrasaoLogoProps) {
  const { branding } = useBranding();
  const logoSrc = customSrc || branding.logoUrl || "/assets/branding/logo-brasao.png";

  const sizeMap = {
    xs: "h-6 w-6",
    sm: "h-8 w-8",
    md: "h-11 w-11",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
    hero: "h-32 w-32",
  };

  return (
    <div className={cn("inline-flex items-center gap-3 select-none", className)} {...props}>
      <div className={cn("relative shrink-0 flex items-center justify-center", sizeMap[size])}>
        <img
          src={logoSrc}
          alt={branding.companyName || "Galeteria Brasão"}
          referrerPolicy="no-referrer"
          loading="eager"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== "/assets/branding/logo-brasao.png" && !target.src.endsWith("/assets/branding/logo-brasao.png")) {
              target.src = "/assets/branding/logo-brasao.png";
            }
          }}
          className="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-transform duration-200 hover:scale-105"
        />
      </div>
      {showText && (
        <div className="flex flex-col text-left leading-none">
          <span className="font-serif text-sm font-extrabold tracking-wider text-amber-500 uppercase">
            {branding.companyName ? branding.companyName.split(" ")[0] : "Galeteria"}
          </span>
          <span className="font-serif text-base font-black tracking-widest text-foreground uppercase">
            {branding.companyName ? branding.companyName.split(" ").slice(1).join(" ") : "Brasão"}
          </span>
        </div>
      )}
    </div>
  );
}

export default BrasaoLogo;
