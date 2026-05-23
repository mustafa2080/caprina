const fs = require('fs');

const filePath = "C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\components\\layout.tsx";
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update NavGroup signature to accept openGroup/onToggle props
const oldNavGroupDef = `function NavGroup({ label, icon: Icon, iconColor, location, prefixes, defaultOpen, children }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  const [open, setOpen] = useState(defaultOpen ?? isGroupActive);
  return (
    <div className="pt-0.5">
      <button type="button" onClick={() => setOpen(v => !v)}`;

const newNavGroupDef = `function NavGroup({ label, icon: Icon, iconColor, location, prefixes, defaultOpen, children, groupKey, openGroup, onToggle }: {
  label: string; icon: any; iconColor: string;
  location: string; prefixes: string[];
  defaultOpen?: boolean; children: React.ReactNode;
  groupKey?: string; openGroup?: string | null; onToggle?: (key: string) => void;
}) {
  const isGroupActive = prefixes.some(p => location === p || location.startsWith(p + "/") || location.startsWith(p));
  // accordion mode when groupKey provided, else local state
  const localOpen = groupKey ? openGroup === groupKey : undefined;
  const [localState, setLocalState] = useState(defaultOpen ?? isGroupActive);
  const open = groupKey ? (localOpen ?? isGroupActive) : localState;
  const handleToggle = () => {
    if (groupKey && onToggle) { onToggle(open ? "" : groupKey); }
    else { setLocalState(v => !v); }
  };
  return (
    <div className="pt-0.5">
      <button type="button" onClick={handleToggle}`;

if (!content.includes('function NavGroup({')) {
  console.log('ERROR: NavGroup def not found');
  process.exit(1);
}

content = content.replace(oldNavGroupDef, newNavGroupDef);

// 2. Add openGroup state to Layout component after existing states
const oldState = `  const [financeOpen, setFinanceOpen] = useState(false);`;
const newState = `  const [financeOpen, setFinanceOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const handleGroupToggle = (key: string) => setOpenGroup(key || null);`;

content = content.replace(oldState, newState);

// 3. Add groupKey/openGroup/onToggle to each NavGroup call
const groups = [
  { label: '"الطلبات"', key: 'orders' },
  { label: '"الشحن والتوصيل"', key: 'shipping' },
  { label: '"المنتجات والمخزون"', key: 'inventory' },
  { label: '"التحليلات"', key: 'analytics' },
  { label: '"الماليات"', key: 'finance' },
  { label: '"الفريق والإدارة"', key: 'team' },
  { label: '"الأدوات"', key: 'tools' },
  { label: '"الإعدادات والدعم"', key: 'settings' },
];

for (const g of groups) {
  // find NavGroup with this label and add props before the closing >
  // pattern: NavGroup label={g.label} ... location={location} prefixes={[...]}
  // we add after prefixes={...}> or defaultOpen={...}>
  const regex = new RegExp(
    `(<NavGroup label=${g.label.replace(/"/g, '"')} [^>]+?)(\\s*>)`,
    's'
  );
  if (regex.test(content)) {
    content = content.replace(regex, `$1 groupKey="${g.key}" openGroup={openGroup} onToggle={handleGroupToggle}$2`);
    console.log('Updated group:', g.key);
  } else {
    console.log('NOT FOUND:', g.label);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('DONE');
