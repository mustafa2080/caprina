const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "artifacts/caprina/src/components/layout.tsx");
let code = fs.readFileSync(filePath, "utf8");

// ── الكود القديم ──────────────────────────────────────────────
const OLD = `function resolveColor(iconColor: string) {
  if (iconColor.includes("orange"))  return "rgba(251,146,60,";
  if (iconColor.includes("sky"))     return "rgba(56,189,248,";
  if (iconColor.includes("violet"))  return "rgba(167,139,250,";
  if (iconColor.includes("pink"))    return "rgba(244,114,182,";
  if (iconColor.includes("fuchsia")) return "rgba(232,121,249,";
  if (iconColor.includes("emerald")) return "rgba(52,211,153,";
  if (iconColor.includes("teal"))    return "rgba(45,212,191,";
  if (iconColor.includes("cyan"))    return "rgba(34,211,238,";
  if (iconColor.includes("lime"))    return "rgba(163,230,53,";
  if (iconColor.includes("green"))   return "rgba(74,222,128,";
  if (iconColor.includes("amber"))   return "rgba(251,191,36,";
  if (iconColor.includes("yellow"))  return "rgba(250,204,21,";
  if (iconColor.includes("red"))     return "rgba(248,113,113,";
  if (iconColor.includes("rose"))    return "rgba(251,113,133,";
  if (iconColor.includes("blue"))    return "rgba(96,165,250,";
  if (iconColor.includes("indigo"))  return "rgba(129,140,248,";
  if (iconColor.includes("purple"))  return "rgba(192,132,252,";
  return "rgba(251,191,36,";
}

function NavGroup({ label, icon: Icon, iconColor, location, prefixes, children, isOpen, onToggle }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  children: React.ReactNode;
  isOpen: boolean; onToggle: () => void;
}) {
  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  const c = resolveColor(iconColor);
  return (
    <div className="pt-0.5">
      <button type="button" onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300",
          isGroupActive ? "text-sidebar-foreground" : "text-sidebar-foreground/55 hover:text-sidebar-foreground/80"
        )}
        style={isGroupActive ? {
          background: \`linear-gradient(135deg, \${c}0.13) 0%, \${c}0.05) 100%)\`,
          border: \`1px solid \${c}0.35)\`,
          boxShadow: \`0 2px 12px \${c}0.2), inset 0 1px 0 \${c}0.12)\`,
        } : { border: "1px solid transparent" }}
      >
        <span className="flex-1 text-right text-xs font-bold tracking-wide">{label}</span>

        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl mx-2 transition-all duration-300 shrink-0"
          style={isGroupActive ? {
            background: \`linear-gradient(145deg, \${c}0.28) 0%, \${c}0.14) 100%)\`,
            boxShadow: \`0 0 0 1px \${c}0.45), 0 0 16px \${c}0.55), 0 4px 8px \${c}0.2)\`,
            border: \`1px solid \${c}0.5)\`,
          } : {
            background: \`linear-gradient(145deg, \${c}0.12) 0%, rgba(255,255,255,0.02) 100%)\`,
            border: \`1px solid \${c}0.2)\`,
          }}
        >
          <Icon className={cn(
            "shrink-0 transition-all duration-300",
            isGroupActive ? "w-5 h-5 scale-110" : "w-4 h-4",
            iconColor
          )} />
        </div>

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

// ── الكود الجديد — Neon Glow Admin Style ─────────────────────
const NEW = `function resolveNeon(iconColor: string): { rgb: string; hex: string } {
  if (iconColor.includes("orange"))  return { rgb: "251,146,60",  hex: "#fb923c" };
  if (iconColor.includes("sky"))     return { rgb: "56,189,248",  hex: "#38bdf8" };
  if (iconColor.includes("violet"))  return { rgb: "167,139,250", hex: "#a78bfa" };
  if (iconColor.includes("pink"))    return { rgb: "244,114,182", hex: "#f472b6" };
  if (iconColor.includes("fuchsia")) return { rgb: "232,121,249", hex: "#e879f9" };
  if (iconColor.includes("emerald")) return { rgb: "52,211,153",  hex: "#34d399" };
  if (iconColor.includes("teal"))    return { rgb: "45,212,191",  hex: "#2dd4bf" };
  if (iconColor.includes("cyan"))    return { rgb: "34,211,238",  hex: "#22d3ee" };
  if (iconColor.includes("lime"))    return { rgb: "163,230,53",  hex: "#a3e635" };
  if (iconColor.includes("green"))   return { rgb: "74,222,128",  hex: "#4ade80" };
  if (iconColor.includes("amber"))   return { rgb: "251,191,36",  hex: "#fbbf24" };
  if (iconColor.includes("yellow"))  return { rgb: "250,204,21",  hex: "#facc15" };
  if (iconColor.includes("red"))     return { rgb: "248,113,113", hex: "#f87171" };
  if (iconColor.includes("rose"))    return { rgb: "251,113,133", hex: "#fb7185" };
  if (iconColor.includes("blue"))    return { rgb: "96,165,250",  hex: "#60a5fa" };
  if (iconColor.includes("indigo"))  return { rgb: "129,140,248", hex: "#818cf8" };
  if (iconColor.includes("purple"))  return { rgb: "192,132,252", hex: "#c084fc" };
  if (iconColor.includes("slate"))   return { rgb: "148,163,184", hex: "#94a3b8" };
  if (iconColor.includes("stone"))   return { rgb: "168,162,158", hex: "#a8a29e" };
  return { rgb: "251,191,36", hex: "#fbbf24" };
}

function NavGroup({ label, icon: Icon, iconColor, location, prefixes, children, isOpen, onToggle }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  children: React.ReactNode;
  isOpen: boolean; onToggle: () => void;
}) {
  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  const neon = resolveNeon(iconColor);
  const r = neon.rgb;

  return (
    <div className="pt-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 group",
          isGroupActive
            ? "text-white"
            : "text-sidebar-foreground/50 hover:text-sidebar-foreground/90"
        )}
        style={isGroupActive ? {
          background: \`linear-gradient(135deg, rgba(\${r},0.08) 0%, rgba(\${r},0.03) 100%)\`,
          borderTop:    \`1px solid rgba(\${r},0.25)\`,
          borderLeft:   \`1px solid rgba(\${r},0.15)\`,
          borderRight:  \`1px solid rgba(\${r},0.1)\`,
          borderBottom: \`1px solid rgba(\${r},0.1)\`,
          boxShadow:    \`inset 0 1px 0 rgba(\${r},0.15)\`,
        } : {
          border: "1px solid transparent",
        }}
      >
        {/* أيقونة Neon */}
        <div
          className="relative flex items-center justify-center shrink-0 transition-all duration-200"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "10px",
            background: isGroupActive
              ? \`rgba(\${r},0.12)\`
              : \`rgba(\${r},0.06)\`,
            border: isGroupActive
              ? \`1px solid rgba(\${r},0.5)\`
              : \`1px solid rgba(\${r},0.18)\`,
            boxShadow: isGroupActive
              ? \`0 0 12px rgba(\${r},0.7), 0 0 24px rgba(\${r},0.35), 0 0 40px rgba(\${r},0.15), inset 0 1px 0 rgba(\${r},0.3)\`
              : \`0 0 0 rgba(\${r},0)\`,
          }}
        >
          {/* Neon core dot عند active */}
          {isGroupActive && (
            <span
              className="absolute inset-0 rounded-[10px]"
              style={{
                background: \`radial-gradient(ellipse at 50% 0%, rgba(\${r},0.25) 0%, transparent 70%)\`,
              }}
            />
          )}
          <Icon
            style={{
              width: isGroupActive ? "17px" : "15px",
              height: isGroupActive ? "17px" : "15px",
              color: \`rgba(\${r},\${isGroupActive ? "1" : "0.65"})\`,
              filter: isGroupActive
                ? \`drop-shadow(0 0 6px rgba(\${r},0.9)) drop-shadow(0 0 12px rgba(\${r},0.5))\`
                : "none",
              transition: "all 0.2s ease",
            }}
          />
        </div>

        {/* اسم القسم */}
        <span
          className="flex-1 text-right font-bold tracking-wide transition-all duration-200"
          style={{
            fontSize: "11.5px",
            color: isGroupActive ? \`rgba(\${r},1)\` : undefined,
            textShadow: isGroupActive ? \`0 0 10px rgba(\${r},0.6)\` : "none",
          }}
        >
          {label}
        </span>

        {/* سهم */}
        <ChevronLeft
          className={cn("shrink-0 transition-transform duration-200", isOpen ? "-rotate-90" : "")}
          style={{
            width: "13px",
            height: "13px",
            color: isGroupActive ? \`rgba(\${r},0.7)\` : "rgba(148,163,184,0.4)",
          }}
        />
      </button>

      {isOpen && (
        <div
          className="mt-0.5 mr-3 pr-1 space-y-0.5 pb-1"
          style={{ borderRight: \`2px solid rgba(\${r},0.25)\` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}`;

if (!code.includes("resolveNeon")) {
  code = code.replace(OLD, NEW);
  fs.writeFileSync(filePath, code, "utf8");
  console.log("SUCCESS - Neon Glow NavGroup applied");
} else {
  console.log("Already patched");
}
