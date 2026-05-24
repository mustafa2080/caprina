path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\components\layout.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '          {/* User info footer */}\n          {!sidebarCollapsed && ('

new = '''          {/* User info footer */}
          {sidebarCollapsed && (
            <div className="shrink-0 border-t border-sidebar-border py-3 flex flex-col items-center gap-2 px-1">
              {/* Theme toggle */}
              <button type="button" onClick={toggleTheme} title={theme === "dark" ? "\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0646\u0647\u0627\u0631\u064a" : "\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a"}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
                style={{
                  background: theme === "dark" ? "linear-gradient(135deg,#1e293b,#0f172a)" : "linear-gradient(135deg,#fef3c7,#fde68a)",
                  border: theme === "dark" ? "1px solid rgba(148,163,184,0.25)" : "1px solid rgba(251,191,36,0.6)",
                  boxShadow: theme === "dark" ? "0 0 8px rgba(148,163,184,0.2)" : "0 0 10px rgba(251,191,36,0.4)",
                }}>
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-600" />}
              </button>
              {/* User avatar */}
              <button type="button" onClick={() => setUserMenuOpen(v => !v)} title={user?.displayName}
                className="relative w-10 h-10 rounded-full flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition-all">
                {(user as any)?.avatar
                  ? <img src={(user as any).avatar} className="w-10 h-10 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                  : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.8),hsl(var(--primary)/0.4))", color: "hsl(var(--primary-foreground))", border: "2px solid hsl(var(--primary)/0.3)" }}>
                      {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-sidebar z-10" style={{boxShadow:"0 0 6px rgba(52,211,153,0.9)"}}>
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" style={{opacity:0.7}} />
                </span>
              </button>
              {userMenuOpen && (
                <div className="absolute bottom-16 right-1 left-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                  <button type="button" onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors">
                    {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-muted-foreground" />}
                    {theme === "dark" ? "\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0641\u0627\u062a\u062d" : "\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u062f\u0627\u0643\u0646"}
                  </button>
                  <button type="button" onClick={() => { setUserMenuOpen(false); setPwDialogOpen(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors">
                    <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />\u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631
                  </button>
                  <button type="button" onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-900/10 transition-colors border-t border-border">
                    <LogOut className="w-3.5 h-3.5" />\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c
                  </button>
                </div>
              )}
            </div>
          )}
          {!sidebarCollapsed && ('''

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS')
else:
    print('NOT_FOUND')
