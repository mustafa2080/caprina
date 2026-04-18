import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { useBrand } from "@/contexts/BrandContext";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

const SIZES = {
  sm: { box: "w-7 h-7 rounded-md text-sm", img: "w-7 h-7 rounded-md" },
  md: { box: "w-10 h-10 rounded-xl text-lg", img: "w-10 h-10 rounded-xl" },
  lg: { box: "w-16 h-16 rounded-2xl text-3xl", img: "w-16 h-16 rounded-2xl" },
};

export function BrandLogoMark({ size = "md", className, onClick }: BrandLogoProps) {
  const { brand } = useBrand();
  const [imgError, setImgError] = useState(false);
  const s = SIZES[size];

  // Priority: DB logo → static file logo → fallback letter
  const logoSrc = brand.logoUrl ?? (BRAND.logoPath ?? null);
  const showImage = logoSrc && !imgError;

  const content = showImage ? (
    <img
      src={logoSrc}
      alt={brand.name}
      key={logoSrc}
      onError={() => setImgError(true)}
      className={cn(s.img, "object-contain", className)}
    />
  ) : (
    <div className={cn(s.box, "bg-primary flex items-center justify-center shrink-0", className)}>
      <span className="font-black text-primary-foreground leading-none">
        {BRAND.fallbackLetter}
      </span>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "shrink-0 transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-xl",
          size === "sm" && "rounded-md",
          size === "lg" && "rounded-2xl"
        )}
        title="إعدادات العلامة التجارية"
      >
        {content}
      </button>
    );
  }

  return content;
}

interface BrandFullProps {
  logoSize?: "sm" | "md" | "lg";
  nameClass?: string;
  taglineClass?: string;
  layout?: "row" | "column";
  onLogoClick?: () => void;
}

export function BrandFull({
  logoSize = "md",
  nameClass,
  taglineClass,
  layout = "column",
  onLogoClick,
}: BrandFullProps) {
  const { brand } = useBrand();

  return (
    <div className={cn("flex items-center gap-3", layout === "column" && "flex-col gap-2")}>
      <BrandLogoMark size={logoSize} onClick={onLogoClick} />
      <div className={layout === "column" ? "text-center" : ""}>
        <p className={cn("font-black tracking-tight", nameClass)}>{brand.name}</p>
        {brand.tagline && (
          <p className={cn("text-[9px] tracking-widest uppercase opacity-40", taglineClass)}>
            {brand.tagline}
          </p>
        )}
      </div>
    </div>
  );
}
