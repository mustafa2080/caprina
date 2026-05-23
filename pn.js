const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "artifacts/caprina/src/components/layout.tsx");

let code;
try {
  code = fs.readFileSync(filePath, "utf8");
  console.log("File read OK, length:", code.length);
} catch(e) {
  console.error("Read error:", e.message);
  process.exit(1);
}

if (!code.includes("bg-sidebar-background shadow-lg")) {
  console.log("Already patched or marker not found"); process.exit(0);
}

const resolveColorFn = `function resolveColor(iconColor: string) {
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

`;

// 1) أضف resolveColor قبل NavGroup
code = code.replace("function NavGroup(", resolveColorFn + "function NavGroup(");

// 2) أضف const c = resolveColor بعد isGroupActive
code = code.replace(
  `  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  return (`,
  `  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  const c = resolveColor(iconColor);
  return (`
);

// 3) بدّل className button
code = code.replace(
  `"w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
          isGroupActive
            ? "bg-foreground/8 text-sidebar-foreground"
            : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-foreground/5"`,
  `"w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300",
          isGroupActive ? "text-sidebar-foreground" : "text-sidebar-foreground/55 hover:text-sidebar-foreground/80"`
);

// 4) بدّل الـ style بتاع الـ button
code = code.replace(
  `        style={isGroupActive ? {
          background: "linear-gradient(135deg, hsl(var(--primary)/0.12) 0%, hsl(var(--primary)/0.04) 100%)",
          border: "1px solid hsl(var(--primary)/0.2)",
          boxShadow: "0 0 8px hsl(var(--primary)/0.1)",
        } : {border: "1px solid transparent"}}`,
  `        style={isGroupActive ? {
          background: \`linear-gradient(135deg, \${c}0.13) 0%, \${c}0.05) 100%)\`,
          border: \`1px solid \${c}0.35)\`,
          boxShadow: \`0 2px 12px \${c}0.2), inset 0 1px 0 \${c}0.12)\`,
        } : { border: "1px solid transparent" }}`
);

// 5) بدّل الـ comment والـ span
code = code.replace(
  `        {/* اسم القسم على اليمين */}
        <span className="flex-1 text-right text-xs font-bold">{label}</span>`,
  `        <span className="flex-1 text-right text-xs font-bold tracking-wide">{label}</span>`
);

// 6) بدّل مربع الأيقونة كاملاً
code = code.replace(
  `        {/* الأيقونة الكبيرة في الوسط */}
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-xl mx-2 transition-all duration-200",
          isGroupActive
            ? "bg-sidebar-background shadow-lg"
            : "bg-foreground/5"
        )} style={isGroupActive ? {
          boxShadow: \`0 0 14px \${iconColor.includes("orange") ? "rgba(251,146,60,0.4)" : iconColor.includes("sky") ? "rgba(56,189,248,0.4)" : iconColor.includes("violet") ? "rgba(167,139,250,0.4)" : iconColor.includes("pink") ? "rgba(244,114,182,0.4)" : iconColor.includes("emerald") ? "rgba(52,211,153,0.4)" : iconColor.includes("amber") ? "rgba(251,191,36,0.4)" : iconColor.includes("red") ? "rgba(248,113,113,0.4)" : iconColor.includes("blue") ? "rgba(96,165,250,0.4)" : "rgba(251,191,36,0.3)"}\`,
        } : {}}>
          <Icon className={cn("w-5 h-5 shrink-0 transition-all duration-200", iconColor, isGroupActive && "scale-110")} />
        </div>`,
  `        <div
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
        </div>`
);

// 7) بدّل كومنت السهم
code = code.replace(
  `        {/* سهم */}
        <ChevronLeft`,
  `        <ChevronLeft`
);

fs.writeFileSync(filePath, code, "utf8");
console.log("SUCCESS - NavGroup upgraded with professional colored icons");
