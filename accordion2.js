const fs = require('fs');

const filePath = "C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\components\\layout.tsx";
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Replace NavGroup function completely - controlled component
const oldNavGroup = `function NavGroup({ label, icon: Icon, iconColor, location, prefixes, defaultOpen, children }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  const [open, setOpen] = useState(defaultOpen ?? isGroupActive);
  return (
    <div className="pt-0.5">
      <button type="button" onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-all",
          isGroupActive ? "text-sidebar-foreground bg-foreground/5" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-foreground/5"
        )}>
        <Icon className={cn("w-3.5 h-3.5 shrink-0", iconColor)} />
        <span className="flex-1 text-right">{label}</span>
        <ChevronLeft className={cn("w-3 h-3 transition-transform text-sidebar-foreground/40", open ? "-rotate-90" : "")} />
      </button>
      {open && (
        <div className="mt-0.5 mr-2 border-r border-sidebar-border/50 pr-1 space-y-0.5 pb-1">
          {children}
        </div>
      )}
    </div>
  );
}`;

const newNavGroup = `function NavGroup({ label, icon: Icon, iconColor, location, prefixes, children, isOpen, onToggle }: {
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
  );
}`;

if (!content.includes('function NavGroup({')) {
  console.log('ERROR: NavGroup not found'); process.exit(1);
}
content = content.replace(oldNavGroup, newNavGroup);
console.log('Step 1 done - NavGroup replaced');

// Step 2: Add openGroup state in Layout (after financeOpen state)
const oldState = `  const [financeOpen, setFinanceOpen] = useState(false);`;
const newState = `  const [financeOpen, setFinanceOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const toggleGroup = (key: string) => setOpenGroup(prev => prev === key ? null : key);`;

if (!content.includes(oldState)) {
  console.log('ERROR: financeOpen state not found'); process.exit(1);
}
content = content.replace(oldState, newState);
console.log('Step 2 done - state added');

// Step 3: Update each NavGroup call to use isOpen/onToggle
const groupMap = [
  { label: '"الطلبات"',          key: 'orders'    },
  { label: '"الشحن والتوصيل"',   key: 'shipping'  },
  { label: '"المنتجات والمخزون"', key: 'inventory' },
  { label: '"التحليلات"',         key: 'analytics' },
  { label: '"الماليات"',          key: 'finance'   },
  { label: '"الفريق والإدارة"',   key: 'team'      },
  { label: '"الأدوات"',           key: 'tools'     },
  { label: '"الإعدادات والدعم"',  key: 'settings'  },
];

for (const g of groupMap) {
  // Remove old extra props if any from previous script
  // Then add isOpen/onToggle
  // Pattern: <NavGroup label={g.label} icon=... location={location} prefixes={[...]}>
  // We'll do a targeted string replace for each group
  const escapedLabel = g.label;
  
  // Find the NavGroup opening tag for this group
  const searchStr = `<NavGroup label=${escapedLabel}`;
  const idx = content.indexOf(searchStr);
  if (idx === -1) { console.log('NOT FOUND:', g.label); continue; }
  
  // Find the closing > of the opening tag
  let closeIdx = content.indexOf('>', idx);
  // But make sure we get the right > (not inside an attribute)
  // Get the tag content
  const tagContent = content.substring(idx, closeIdx + 1);
  
  // Build new tag - extract just what we need
  // Remove defaultOpen if present, add isOpen/onToggle
  let newTag = tagContent
    .replace(/\s*defaultOpen=\{[^}]+\}/g, '')
    .replace(/\s*groupKey="[^"]*"/g, '')
    .replace(/\s*openGroup=\{[^}]+\}/g, '')
    .replace(/\s*onToggle=\{[^}]+\}/g, '')
    .replace('>', ` isOpen={openGroup === "${g.key}"} onToggle={() => toggleGroup("${g.key}")}>`);
  
  content = content.substring(0, idx) + newTag + content.substring(closeIdx + 1);
  console.log('Step 3 updated:', g.key);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('ALL DONE');
