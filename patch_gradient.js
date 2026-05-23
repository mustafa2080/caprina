const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "artifacts/caprina/src/components/layout.tsx");
let code = fs.readFileSync(filePath, "utf8");

const OLD_MARKER = `function resolveRgb(iconColor: string): string {`;
const END_MARKER = `\nexport default function Layout({ children }: LayoutProps) {`;

const startIdx = code.indexOf(OLD_MARKER);
const endIdx   = code.indexOf(END_MARKER);

if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found:", startIdx, endIdx);
  process.exit(1);
}

const NEW = `function resolveRgb(iconColor: string): string {
  if (iconColor.includes("orange"))  return "251,146,60";
  if (iconColor.includes("sky"))     return "56,189,248";
  if (iconColor.includes("violet"))  return "167,139,250";
  if (iconColor.includes("pink"))    return "244,114,182";
  if (iconColor.includes("fuchsia")) return "232,121,249";
  if (iconColor.includes("emerald")) return "52,211,153";
  if (iconColor.includes("teal"))    return "45,212,191";
  if (iconColor.includes("cyan"))    return "34,211,238";
  if (iconColor.includes("lime"))    return "163,230,53";
  if (iconColor.includes("green"))   return "74,222,128";
  if (iconColor.includes("amber"))   return "251,191,36";
  if (iconColor.includes("yellow"))  return "250,204,21";
  if (iconColor.includes("red"))     return "248,113,113";
  if (iconColor.includes("rose"))    return "251,113,133";
  if (iconColor.includes("blue"))    return "96,165,250";
  if (iconColor.includes("indigo"))  return "129,140,248";
  if (iconColor.includes("purple"))  return "192,132,252";
  if (iconColor.includes("slate"))   return "148,163,184";
  if (iconColor.includes("stone"))   return "168,162,158";
  return "251,191,36";
}

function NavGroup({ label, icon: Icon, iconColor, location, prefixes, children, isOpen, onToggle }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  children: React.ReactNode;
  isOpen: boolean; onToggle: () => void;
}) {
  const isActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  const rgb = resolveRgb(iconColor);

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group",
          isActive ? "text-white" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-white/[0.03]"
        )}
        style={isActive ? {
          background: \`linear-gradient(135deg, rgba(\${rgb},0.1) 0%, rgba(\${rgb},0.04) 100%)\`,
          border: \`1px solid rgba(\${rgb},0.2)\`,
          boxShadow: \`0 1px 6px rgba(\${rgb},0.12)\`,
        } : { border: "1px solid transparent" }}
      >
        {/* أيقونة كبيرة بتدرج ألوان وshadow */}
        <div
          className="shrink-0 flex items-center justify-center transition-all duration-200"
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "11px",
            background: isActive
              ? \`linear-gradient(145deg, rgba(\${rgb},0.9) 0%, rgba(\${rgb},0.55) 60%, rgba(\${rgb},0.3) 100%)\`
              : \`linear-gradient(145deg, rgba(\${rgb},0.18) 0%, rgba(\${rgb},0.08) 100%)\`,
            border: isActive
              ? \`1px solid rgba(\${rgb},0.6)\`
              : \`1px solid rgba(\${rgb},0.15)\`,
            boxShadow: isActive
              ? \`0 4px 14px rgba(\${rgb},0.45), 0 1px 4px rgba(\${rgb},0.3), inset 0 1px 0 rgba(255,255,255,0.2)\`
              : \`0 2px 6px rgba(\${rgb},0.12), inset 0 1px 0 rgba(255,255,255,0.06)\`,
          }}
        >
          <Icon
            style={{
              width: isActive ? "19px" : "17px",
              height: isActive ? "19px" : "17px",
              color: isActive ? "rgba(255,255,255,0.95)" : \`rgba(\${rgb},0.7)\`,
              filter: isActive ? "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" : "none",
              transition: "all 0.2s ease",
            }}
          />
        </div>

        {/* الاسم */}
        <span
          className="flex-1 text-right font-semibold transition-colors duration-200"
          style={{ fontSize: "12px", letterSpacing: "0.01em" }}
        >
          {label}
        </span>

        {/* سهم */}
        <ChevronLeft
          className={cn("shrink-0 transition-transform duration-200", isOpen ? "-rotate-90" : "")}
          style={{
            width: "13px",
            height: "13px",
            color: isActive ? \`rgba(\${rgb},0.6)\` : "rgba(100,116,139,0.35)",
          }}
        />
      </button>

      {isOpen && (
        <div
          className="mt-1 mr-3 pr-1.5 space-y-px pb-1"
          style={{ borderRight: \`2px solid rgba(\${rgb},0.2)\` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

`;

code = code.slice(0, startIdx) + NEW + code.slice(endIdx + 1);
fs.writeFileSync(filePath, code, "utf8");
console.log("SUCCESS");
