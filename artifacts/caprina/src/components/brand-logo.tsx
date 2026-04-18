import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { box: "w-7 h-7 rounded-md text-sm", img: "w-7 h-7 rounded-md" },
  md: { box: "w-10 h-10 rounded-xl text-lg", img: "w-10 h-10 rounded-xl" },
  lg: { box: "w-16 h-16 rounded-2xl text-3xl", img: "w-16 h-16 rounded-2xl" },
};

export function BrandLogoMark({ size = "md", className }: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);
  const s = SIZES[size];
  const showImage = BRAND.logoPath && !imgError;

  if (showImage) {
    return (
      <img
        src={BRAND.logoPath!}
        alt={BRAND.name}
        onError={() => setImgError(true)}
        className={cn(s.img, "object-contain", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        s.box,
        "bg-primary flex items-center justify-center shrink-0",
        className
      )}
    >
      <span className="font-black text-primary-foreground leading-none">
        {BRAND.fallbackLetter}
      </span>
    </div>
  );
}

interface BrandFullProps {
  logoSize?: "sm" | "md" | "lg";
  nameClass?: string;
  taglineClass?: string;
  layout?: "row" | "column";
}

export function BrandFull({
  logoSize = "md",
  nameClass,
  taglineClass,
  layout = "column",
}: BrandFullProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        layout === "column" && "flex-col gap-2"
      )}
    >
      <BrandLogoMark size={logoSize} />
      <div className={layout === "column" ? "text-center" : ""}>
        <p className={cn("font-black tracking-tight", nameClass)}>{BRAND.name}</p>
        {BRAND.tagline && (
          <p className={cn("text-[9px] tracking-widest uppercase opacity-40", taglineClass)}>
            {BRAND.tagline}
          </p>
        )}
      </div>
    </div>
  );
}
