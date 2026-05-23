$file = 'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\components\layout.tsx'
$code = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$new = @'
function resolveColor(iconColor: string) {
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
          background: `linear-gradient(135deg, ${c}0.13) 0%, ${c}0.05) 100%)`,
          border: `1px solid ${c}0.35)`,
          boxShadow: `0 2px 12px ${c}0.2), inset 0 1px 0 ${c}0.12)`,
        } : { border: "1px solid transparent" }}
      >
        <span className="flex-1 text-right text-xs font-bold tracking-wide">{label}</span>

        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl mx-2 transition-all duration-300 shrink-0"
          style={isGroupActive ? {
            background: `linear-gradient(145deg, ${c}0.28) 0%, ${c}0.14) 100%)`,
            boxShadow: `0 0 0 1px ${c}0.45), 0 0 16px ${c}0.55), 0 4px 8px ${c}0.2)`,
            border: `1px solid ${c}0.5)`,
          } : {
            background: `linear-gradient(145deg, ${c}0.12) 0%, rgba(255,255,255,0.02) 100%)`,
            border: `1px solid ${c}0.2)`,
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
}
'@

# ابحث عن الـ NavGroup القديم وبدّله
$pattern = '(?s)function NavGroup\(\{.*?\n\}'
if ($code -match $pattern) {
    $code = [System.Text.RegularExpressions.Regex]::Replace($code, $pattern, $new.Trim())
    [System.IO.File]::WriteAllText($file, $code, [System.Text.Encoding]::UTF8)
    Write-Host "SUCCESS - NavGroup replaced"
} else {
    Write-Host "PATTERN NOT MATCHED"
}
