const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts', 'caprina', 'src', 'components', 'layout.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Find NavGroup function start and end
let ngStart = -1, ngEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function NavGroup({')) { ngStart = i; }
  if (ngStart > -1 && ngEnd === -1 && i > ngStart && lines[i].trim() === '}') {
    ngEnd = i; break;
  }
}
console.log('NavGroup:', ngStart, '-', ngEnd);
console.log('First line:', lines[ngStart]);
console.log('Last line:', lines[ngEnd]);

// Replace NavGroup with controlled version
const newNavGroup = [
  `function NavGroup({ label, icon: Icon, iconColor, location, prefixes, children, isOpen, onToggle }: {`,
  `  label: string; icon: any; iconColor: string;`,
  `  location: string; prefixes: string[];`,
  `  children: React.ReactNode;`,
  `  isOpen: boolean; onToggle: () => void;`,
  `}) {`,
  `  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));`,
  `  return (`,
  `    <div className="pt-0.5">`,
  `      <button type="button" onClick={onToggle}`,
  `        className={cn(`,
  `          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-all",`,
  `          isGroupActive ? "text-sidebar-foreground bg-foreground/5" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-foreground/5"`,
  `        )}>`,
  `        <Icon className={cn("w-3.5 h-3.5 shrink-0", iconColor)} />`,
  `        <span className="flex-1 text-right">{label}</span>`,
  `        <ChevronLeft className={cn("w-3 h-3 transition-transform text-sidebar-foreground/40", isOpen ? "-rotate-90" : "")} />`,
  `      </button>`,
  `      {isOpen && (`,
  `        <div className="mt-0.5 mr-2 border-r border-sidebar-border/50 pr-1 space-y-0.5 pb-1">`,
  `          {children}`,
  `        </div>`,
  `      )}`,
  `    </div>`,
  `  );`,
  `}`,
];

lines.splice(ngStart, ngEnd - ngStart + 1, ...newNavGroup);
console.log('NavGroup replaced');

// Find financeOpen state line
let financeIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('financeOpen') && lines[i].includes('useState')) {
    financeIdx = i; break;
  }
}
console.log('financeOpen at line:', financeIdx);

// Insert openGroup state after financeOpen
const newStateLines = [
  `  const [openGroup, setOpenGroup] = useState<string | null>(null);`,
  `  const toggleGroup = (key: string) => setOpenGroup(prev => prev === key ? null : key);`,
];
// Remove any existing openGroup lines first
lines = lines.filter(l => !l.includes('openGroup') && !l.includes('toggleGroup') && !l.includes('handleGroupToggle'));

// Re-find financeOpen after filter
financeIdx = lines.findIndex(l => l.includes('financeOpen') && l.includes('useState'));
lines.splice(financeIdx + 1, 0, ...newStateLines);
console.log('State added at:', financeIdx + 1);

// Now fix all NavGroup usages - add isOpen/onToggle, remove old props
const groupMap = {
  '"الطلبات"':          'orders',
  '"الشحن والتوصيل"':   'shipping',
  '"المنتجات والمخزون"': 'inventory',
  '"التحليلات"':         'analytics',
  '"الماليات"':          'finance',
  '"الفريق والإدارة"':   'team',
  '"الأدوات"':           'tools',
  '"الإعدادات والدعم"':  'settings',
};

const content = lines.join('\n');
let newContent = content;

for (const [labelStr, key] of Object.entries(groupMap)) {
  // Match <NavGroup label={labelStr} ... > (possibly multiline but these are single line)
  const regex = new RegExp(
    `<NavGroup\\s+label=${labelStr.replace(/"/g, '"')}([^>]*)>`,
    'g'
  );
  newContent = newContent.replace(regex, (match, attrs) => {
    // Remove old accordion props if any
    let cleaned = attrs
      .replace(/\s+defaultOpen=\{[^}]+\}/g, '')
      .replace(/\s+groupKey="[^"]*"/g, '')
      .replace(/\s+openGroup=\{[^}]+\}/g, '')
      .replace(/\s+onToggle=\{[^}]+\}/g, '')
      .replace(/\s+isOpen=\{[^}]+\}/g, '');
    return `<NavGroup label=${labelStr}${cleaned} isOpen={openGroup === "${key}"} onToggle={() => toggleGroup("${key}")}>`;
  });
  
  const found = newContent.includes(`isOpen={openGroup === "${key}"}`);
  console.log('Group', key, found ? 'OK' : 'NOT FOUND');
}

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('ALL DONE - total lines:', newContent.split('\n').length);
