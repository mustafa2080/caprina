const fs = require('fs');
const path = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/layout.tsx';
let c = fs.readFileSync(path, 'utf8');

const oldStr = `  return (
    <div className="pt-0.5">
      <button type="button" onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-all",
          isGroupActive ? "text-sidebar-foreground bg-foreground/5" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-foreground/5"
        )}>
        <Icon className={cn("w-3.5 h-3.5 shrink-0", iconColor)} />
        <span className="flex-1 text-right">{label}</span>
        <ChevronLeft className={cn("w-3 h-3 transition-transform text-sidebar-foreground/40", isOpen ? "-rotate-90" : "")} />
      </button>
      {isOpen && (
        <div className="mt-0.5 mr-2 border-r border-sidebar-border/50 pr-1 space-y-0.5 pb-1">
          {children}
        </div>
      )}
    </div>
  );`;

const newStr = `  return (
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
  );`;

if (c.includes(oldStr)) {
  c = c.replace(oldStr, newStr);
  fs.writeFileSync(path, c, 'utf8');
  console.log('Done LF!');
} else {
  const oldCRLF = oldStr.replace(/\n/g, '\r\n');
  if (c.includes(oldCRLF)) {
    c = c.replace(oldCRLF, newStr);
    fs.writeFileSync(path, c, 'utf8');
    console.log('Done CRLF!');
  } else {
    console.log('NOT FOUND');
  }
}
