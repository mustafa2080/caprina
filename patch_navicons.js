const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "artifacts/caprina/src/components/layout.tsx");
let code = fs.readFileSync(file, "utf8");

// استبدل الـ NavGroup function كاملة
const oldNavGroup = `function NavGroup({ label, icon: Icon, iconColor, location, prefixes, children, isOpen, onToggle }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  children: React.ReactNode;
  isOpen: boolean; onToggle: () => void;
}) {
  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  return (
    <div className="pt-0.5">
      <button type="button" onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
          isGroupActive
            ? "bg-foreground/8 text-sidebar-foreground"
            : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-foreground/5"
        )}
        style={isGroupActive ? {
          background: "linear-gradient(135deg, hsl(var(--primary)/0.12) 0%, hsl(var(--primary)/0.04) 100%)",
          border: "1px solid hsl(var(--primary)/0.2)",
          boxShadow: "0 0 8px hsl(var(--primary)/0.1)",
        } : {border: "1px solid transparent"}}
      >
        {/* اسم القسم على اليمين */}
        <span className="flex-1 text-right text-xs font-bold">{label}</span>

        {/* الأيقونة الكبيرة في الوسط */}
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-xl mx-2 transition-all duration-200",
          isGroupActive
            ? "bg-sidebar-background shadow-lg"
            : "bg-foreground/5"
        )} style={isGroupActive ? {
          boxShadow: \`0 0 14px \${iconColor.includes("orange") ? "rgba(251,146,60,0.4)" : iconColor.includes("sky") ? "rgba(56,189,248,0.4)" : iconColor.includes("violet") ? "rgba(167,139,250,0.4)" : iconColor.includes("pink") ? "rgba(244,114,182,0.4)" : iconColor.includes("emerald") ? "rgba(52,211,153,0.4)" : iconColor.includes("amber") ? "rgba(251,191,36,0.4)" : iconColor.includes("red") ? "rgba(248,113,113,0.4)" : iconColor.includes("blue") ? "rgba(96,165,250,0.4)" : "rgba(251,191,36,0.3)"}\`,
        } : {}}>
          <Icon className={cn("w-5 h-5 shrink-0 transition-all duration-200", iconColor, isGroupActive && "scale-110")} />
        </div>

        {/* سهم */}
        <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform text-sidebar-foreground/30 shrink-0", isOpen ? "-rotate-90" : "")} />
      </button>
      {isOpen && (
        <div className="mt-1 mr-2 border-r-2 border-primary/20 pr-1 space-y-0.5 pb-1">
          {children}
        </div>
      )}
    </div>
  );
}`;

// دالة مساعدة لتحويل iconColor لـ RGB
const colorMap = {
  orange: { bg: "rgba(251,146,60,0.15)", glow: "rgba(251,146,60,0.5)", solid: "rgba(251,146,60,0.9)" },
  sky:    { bg: "rgba(56,189,248,0.15)",  glow: "rgba(56,189,248,0.5)",  solid: "rgba(56,189,248,0.9)"  },
  violet: { bg: "rgba(167,139,250,0.15)", glow: "rgba(167,139,250,0.5)", solid: "rgba(167,139,250,0.9)" },
  pink:   { bg: "rgba(244,114,182,0.15)", glow: "rgba(244,114,182,0.5)", solid: "rgba(244,114,182,0.9)" },
  emerald:{ bg: "rgba(52,211,153,0.15)",  glow: "rgba(52,211,153,0.5)",  solid: "rgba(52,211,153,0.9)"  },
  amber:  { bg: "rgba(251,191,36,0.15)",  glow: "rgba(251,191,36,0.5)",  solid: "rgba(251,191,36,0.9)"  },
  red:    { bg: "rgba(248,113,113,0.15)", glow: "rgba(248,113,113,0.5)", solid: "rgba(248,113,113,0.9)" },
  blue:   { bg: "rgba(96,165,250,0.15)",  glow: "rgba(96,165,250,0.5)",  solid: "rgba(96,165,250,0.9)"  },
  teal:   { bg: "rgba(45,212,191,0.15)",  glow: "rgba(45,212,191,0.5)",  solid: "rgba(45,212,191,0.9)"  },
  lime:   { bg: "rgba(163,230,53,0.15)",  glow: "rgba(163,230,53,0.5)",  solid: "rgba(163,230,53,0.9)"  },
  fuchsia:{ bg: "rgba(232,121,249,0.15)", glow: "rgba(232,121,249,0.5)", solid: "rgba(232,121,249,0.9)" },
};

const newNavGroup = `function getIconStyle(iconColor: string, active: boolean) {
  const key = Object.keys({orange:1,sky:1,violet:1,pink:1,emerald:1,amber:1,red:1,blue:1,teal:1,lime:1,fuchsia:1}).find(k => iconColor.includes(k)) || "amber";
  const map: Record<string, {bg:string,glow:string,solid:string}> = {
    orange: { bg: "rgba(251,146,60,0.15)", glow: "rgba(251,146,60,0.5)", solid: "rgba(251,146,60,0.9)" },
    sky:    { bg: "rgba(56,189,248,0.15)",  glow: "rgba(56,189,248,0.5)",  solid: "rgba(56,189,248,0.9)"  },
    violet: { bg: "rgba(167,139,250,0.15)", glow: "rgba(167,139,250,0.5)", solid: "rgba(167,139,250,0.9)" },
    pink:   { bg: "rgba(244,114,182,0.15)", glow: "rgba(244,114,182,0.5)", solid: "rgba(244,114,182,0.9)" },
    emerald:{ bg: "rgba(52,211,153,0.15)",  glow: "rgba(52,211,153,0.5)",  solid: "rgba(52,211,153,0.9)"  },
    amber:  { bg: "rgba(251,191,36,0.15)",  glow: "rgba(251,191,36,0.5)",  solid: "rgba(251,191,36,0.9)"  },
    red:    { bg: "rgba(248,113,113,0.15)", glow: "rgba(248,113,113,0.5)", solid: "rgba(248,113,113,0.9)" },
    blue:   { bg: "rgba(96,165,250,0.15)",  glow: "rgba(96,165,250,0.5)",  solid: "rgba(96,165,250,0.9)"  },
    teal:   { bg: "rgba(45,212,191,0.15)",  glow: "rgba(45,212,191,0.5)",  solid: "rgba(45,212,191,0.9)"  },
    lime:   { bg: "rgba(163,230,53,0.15)",  glow: "rgba(163,230,53,0.5)",  solid: "rgba(163,230,53,0.9)"  },
    fuchsia:{ bg: "rgba(232,121,249,0.15)", glow: "rgba(232,121,249,0.5)", solid: "rgba(232,121,249,0.9)" },
  };
  const c = map[key];
  if (active) return {
    background: \`linear-gradient(135deg, \${c.bg} 0%, \${c.bg.replace("0.15","0.08")} 100%)\`,
    boxShadow: \`0 0 0 1px \${c.glow.replace("0.5","0.3")}, 0 4px 16px \${c.glow.replace("0.5","0.25")}, inset 0 1px 0 \${c.solid.replace("0.9","0.15")}\`,
    border: \`1px solid \${c.glow.replace("0.5","0.4")}\`,
  };
  return { border: "1px solid transparent" };
}

function getIconBoxStyle(iconColor: string, active: boolean) {
  const key = Object.keys({orange:1,sky:1,violet:1,pink:1,emerald:1,amber:1,red:1,blue:1,teal:1,lime:1,fuchsia:1}).find(k => iconColor.includes(k)) || "amber";
  const map: Record<string, {bg:string,glow:string,solid:string}> = {
    orange: { bg: "rgba(251,146,60,0.15)", glow: "rgba(251,146,60,0.5)", solid: "rgba(251,146,60,0.9)" },
    sky:    { bg: "rgba(56,189,248,0.15)",  glow: "rgba(56,189,248,0.5)",  solid: "rgba(56,189,248,0.9)"  },
    violet: { bg: "rgba(167,139,250,0.15)", glow: "rgba(167,139,250,0.5)", solid: "rgba(167,139,250,0.9)" },
    pink:   { bg: "rgba(244,114,182,0.15)", glow: "rgba(244,114,182,0.5)", solid: "rgba(244,114,182,0.9)" },
    emerald:{ bg: "rgba(52,211,153,0.15)",  glow: "rgba(52,211,153,0.5)",  solid: "rgba(52,211,153,0.9)"  },
    amber:  { bg: "rgba(251,191,36,0.15)",  glow: "rgba(251,191,36,0.5)",  solid: "rgba(251,191,36,0.9)"  },
    red:    { bg: "rgba(248,113,113,0.15)", glow: "rgba(248,113,113,0.5)", solid: "rgba(248,113,113,0.9)" },
    blue:   { bg: "rgba(96,165,250,0.15)",  glow: "rgba(96,165,250,0.5)",  solid: "rgba(96,165,250,0.9)"  },
    teal:   { bg: "rgba(45,212,191,0.15)",  glow: "rgba(45,212,191,0.5)",  solid: "rgba(45,212,191,0.9)"  },
    lime:   { bg: "rgba(163,230,53,0.15)",  glow: "rgba(163,230,53,0.5)",  solid: "rgba(163,230,53,0.9)"  },
    fuchsia:{ bg: "rgba(232,121,249,0.15)", glow: "rgba(232,121,249,0.5)", solid: "rgba(232,121,249,0.9)" },
  };
  const c = map[key];
  if (active) return {
    background: \`linear-gradient(145deg, \${c.bg.replace("0.15","0.25")} 0%, \${c.bg.replace("0.15","0.12")} 100%)\`,
    boxShadow: \`0 0 12px \${c.glow.replace("0.5","0.6")}, 0 0 0 1px \${c.glow.replace("0.5","0.35")}\`,
    border: \`1px solid \${c.solid.replace("0.9","0.4")}\`,
  };
  return {
    background: \`linear-gradient(145deg, \${c.bg.replace("0.15","0.1")} 0%, rgba(255,255,255,0.03) 100%)\`,
    border: \`1px solid \${c.glow.replace("0.5","0.15")}\`,
  };
}

function NavGroup({ label, icon: Icon, iconColor, location, prefixes, children, isOpen, onToggle }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  children: React.ReactNode;
  isOpen: boolean; onToggle: () => void;
}) {
  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  return (
    <div className="pt-0.5">
      <button type="button" onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300",
          isGroupActive
            ? "text-sidebar-foreground"
            : "text-sidebar-foreground/55 hover:text-sidebar-foreground/80"
        )}
        style={getIconStyle(iconColor, isGroupActive)}
      >
        {/* اسم القسم على اليمين */}
        <span className="flex-1 text-right text-xs font-bold tracking-wide">{label}</span>

        {/* الأيقونة الاحترافية في الوسط */}
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl mx-2 transition-all duration-300"
          style={getIconBoxStyle(iconColor, isGroupActive)}
        >
          <Icon className={cn(
            "transition-all duration-300 shrink-0",
            isGroupActive ? "w-5 h-5 scale-110" : "w-4 h-4",
            iconColor
          )} />
        </div>

        {/* سهم */}
        <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform text-sidebar-foreground/30 shrink-0", isOpen ? "-rotate-90" : "")} />
      </button>
      {isOpen && (
        <div className="mt-1 mr-2 border-r-2 border-primary/20 pr-1 space-y-0.5 pb-1">
          {children}
        </div>
      )}
    </div>
  );
}`;

if (!code.includes("getIconStyle")) {
  code = code.replace(oldNavGroup, newNavGroup);
  fs.writeFileSync(file, code, "utf8");
  console.log("✅ NavGroup upgraded with professional icon styles");
} else {
  console.log("ℹ️ Already patched");
}
