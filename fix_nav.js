const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts', 'caprina', 'src', 'components', 'layout.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Find the nav section start and end
let navStart = -1, navEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<nav className=') && lines[i].includes('px-2 py-3')) navStart = i;
  if (navStart > -1 && lines[i].includes('</nav>')) { navEnd = i; break; }
}
console.log('nav section:', navStart, '-', navEnd);

// Build the complete new nav section
const newNav = `        <nav className="px-2 py-3 flex-1 space-y-0.5 overflow-y-auto">

          {/* ── لوحة التحكم ── */}
          {visibleNav.filter(i => i.group === "dashboard").map(item => <NavItem key={item.href} item={item} location={location} />)}

          {/* ── الطلبات ── */}
          {visibleNav.some(i => i.group === "orders") && (
            <NavGroup label="الطلبات" icon={Package} iconColor="text-orange-400" location={location} prefixes={["/orders","/invoices","/shipping-followup"]} isOpen={openGroup === "orders"} onToggle={() => toggleGroup("orders")}>
              {visibleNav.filter(i => i.group === "orders").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── الشحن والتوصيل ── */}
          {visibleNav.some(i => i.group === "shipping") && (
            <NavGroup label="الشحن والتوصيل" icon={Truck} iconColor="text-sky-400" location={location} prefixes={["/shipping"]} isOpen={openGroup === "shipping"} onToggle={() => toggleGroup("shipping")}>
              {visibleNav.filter(i => i.group === "shipping").map(item => <NavItem key={item.href} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── المنتجات والمخزون ── */}
          {visibleNav.some(i => i.group === "inventory") && (
            <NavGroup label="المنتجات والمخزون" icon={Boxes} iconColor="text-violet-400" location={location} prefixes={["/inventory","/warehouses","/movements"]} isOpen={openGroup === "inventory"} onToggle={() => toggleGroup("inventory")}>
              {visibleNav.filter(i => i.group === "inventory").map(item => <NavItem key={item.href} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── التحليلات ── */}
          {visibleNav.some(i => i.group === "analytics") && (
            <NavGroup label="التحليلات" icon={BarChart3} iconColor="text-pink-400" location={location} prefixes={["/product-performance","/smart","/ads-analytics","/team-performance","/sessions-report"]} isOpen={openGroup === "analytics"} onToggle={() => toggleGroup("analytics")}>
              {visibleNav.filter(i => i.group === "analytics").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── الماليات ── */}
          {(isAdmin || can("finance")) && (
            <NavGroup label="الماليات" icon={DollarSign} iconColor="text-emerald-400" location={location} prefixes={["/finance"]} isOpen={openGroup === "finance"} onToggle={() => toggleGroup("finance")}>
              {FINANCE_NAV.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}
                    className={cn("flex items-center gap-3 px-3 py-1.5 rounded-md text-xs font-semibold transition-all mr-2 group",
                      isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-foreground/5")}>
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary-foreground" : item.iconColor)} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </NavGroup>
          )}

          {/* ── الفريق والإدارة ── */}
          {visibleNav.some(i => i.group === "team") && (
            <NavGroup label="الفريق والإدارة" icon={Users} iconColor="text-green-400" location={location} prefixes={["/team","/team-performance","/users","/audit-logs"]} isOpen={openGroup === "team"} onToggle={() => toggleGroup("team")}>
              {visibleNav.filter(i => i.group === "team").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── الأدوات ── */}
          {visibleNav.some(i => i.group === "tools") && (
            <NavGroup label="الأدوات" icon={Upload} iconColor="text-amber-400" location={location} prefixes={["/import","/export","/archive"]} isOpen={openGroup === "tools"} onToggle={() => toggleGroup("tools")}>
              {visibleNav.filter(i => i.group === "tools").map(item => <NavItem key={item.href} item={item} location={location} sub />)}
            </NavGroup>
          )}

          {/* ── الإعدادات والدعم ── */}
          {visibleNav.some(i => i.group === "settings") && (
            <NavGroup label="الإعدادات والدعم" icon={MessageCircle} iconColor="text-emerald-500" location={location} prefixes={["/whatsapp","/audit-logs"]} isOpen={openGroup === "settings"} onToggle={() => toggleGroup("settings")}>
              {visibleNav.filter(i => i.group === "settings").map(item => <NavItem key={item.href+item.label} item={item} location={location} sub />)}
            </NavGroup>
          )}`;

// Replace lines from navStart to navEnd (keep </nav>)
const before = lines.slice(0, navStart);
const after = lines.slice(navEnd); // includes </nav> line
const newLines = [...before, ...newNav.split('\n'), ...after];

fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('SUCCESS - nav section replaced');
console.log('Total lines:', newLines.length);
