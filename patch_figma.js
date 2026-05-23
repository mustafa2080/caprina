const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "artifacts/caprina/src/components/layout.tsx");
let code = fs.readFileSync(filePath, "utf8");

const OLD_MARKER  = `function resolveNeon(iconColor: string): { rgb: string; hex: string } {`;
const END_MARKER  = `\nexport default function Layout({ children }: LayoutProps) {`;

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
    <div className="pt-px">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-150 group",
          isActive ? "text-white" : "text-sidebar-foreground/45 hover:text-sidebar-foreground/80 hover:bg-white/[0.04]"
        )}
        style={isActive ? {
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
        } : { border: "1px solid transparent" }}
      >
        {/* أيقونة — مربع صغير نظيف — Figma/VS Code style */}
        <div
          className="shrink-0 flex items-center justify-center transition-all duration-150"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "7px",
            background: isActive
              ? \`rgba(\${rgb},0.15)\`
              : "rgba(255,255,255,0.04)",
            border: isActive
              ? \`1px solid rgba(\${rgb},0.35)\`
              : "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <Icon
            style={{
              width: "14px",
              height: "14px",
              color: isActive ? \`rgba(\${rgb},1)\` : "rgba(148,163,184,0.55)",
              transition: "color 0.15s ease",
            }}
          />
        </div>

        {/* الاسم */}
        <span
          className="flex-1 text-right font-medium transition-colors duration-150"
          style={{
            fontSize: "11.5px",
            letterSpacing: "0.01em",
            color: isActive ? \`rgba(\${rgb},0.95)\` : undefined,
          }}
        >
          {label}
        </span>

        {/* سهم */}
        <ChevronLeft
          className={cn("shrink-0 transition-transform duration-150", isOpen ? "-rotate-90" : "")}
          style={{
            width: "12px",
            height: "12px",
            color: isActive ? \`rgba(\${rgb},0.5)\` : "rgba(100,116,139,0.4)",
          }}
        />
      </button>

      {isOpen && (
        <div
          className="mt-0.5 mr-3 pr-1.5 space-y-px pb-1"
          style={{ borderRight: \`1.5px solid rgba(\${rgb},0.2)\` }}
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
console.log("SUCCESS - Figma/VS Code style applied");
