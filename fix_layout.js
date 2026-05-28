const fs = require('fs');
const filePath = 'C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\components\\layout.tsx';

let content = fs.readFileSync(filePath, 'utf8');

// ─── 1. Fix collapsed sidebar avatar — بنفس الـ line break sequence ───────────
// ابحث عن الـ pattern بـ regex عشان نتجنب مشاكل الـ whitespace
content = content.replace(
  /\{\/\* User avatar \*\/\}\s+<button type="button" onClick=\{\(\) => setUserMenuOpen\(v => !v\)\} title=\{user\?\.displayName\}/,
  `{/* User avatar — click opens menu */}\n                <button type="button" title={user?.displayName}\n                  onClick={(e) => { e.stopPropagation(); const r=e.currentTarget.getBoundingClientRect(); setUserMenuPos({top:r.top,left:r.right+10,width:200}); setUserMenuOpen(v=>!v); }}`
);

const c1 = content.includes('click opens menu');
console.log('fix1 collapsed avatar:', c1);

// ─── 2. Fix expanded footer avatar div — اعمله button ───────────────────────
// الـ div ده مكتوب كـ <div className="relative shrink-0">  (بدون onClick)
// هنضيف onClick عليه
content = content.replace(
  /<div className="relative shrink-0">\s+\{\(user as any\)\?\.avatar\s+\? <img src=\{\(user as any\)\.avatar\} className="w-8 h-8 rounded-full object-cover border-2 border-primary\/30" alt=\{user\?\.displayName\} \/>\s+: <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"\s+style=\{\{ background: "linear-gradient\(135deg,hsl\(var\(--primary\)\/0\.8\),hsl\(var\(--primary\)\/0\.4\)\)", color: "hsl\(var\(--primary-foreground\)\)", border: "2px solid hsl\(var\(--primary\)\/0\.3\)" \}\}>\s+\{user\?\.displayName\?\.charAt\(0\)\?\.toUpperCase\(\) \?\? "\?"\}\s+<\/div>\}\s+<span className="absolute -bottom-0\.5 -right-0\.5 w-2\.5 h-2\.5 rounded-full bg-emerald-400 border-2 border-sidebar z-10" style=\{\{boxShadow:"0 0 6px rgba\(52,211,153,0\.9\)"\}\}>\s+<span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" style=\{\{opacity:0\.7\}\} \/>\s+<\/span>\s+<\/div>\s+\{\/\* \u0632\u0631 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c \*\/\}/,
  (match) => {
    return match
      .replace('<div className="relative shrink-0">', '<button type="button" title="\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645" className="relative shrink-0 rounded-full hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"\n                  onClick={(e)=>{const r=e.currentTarget.getBoundingClientRect();setUserMenuPos({top:r.top,left:r.right+10,width:200});setUserMenuOpen(v=>!v)}}>')
      .replace('</div>\n                {/* \u0632\u0631 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c */', '</button>\n                {/* \u0632\u0631 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c */}');
  }
);

const c2 = content.includes('\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645');
console.log('fix2 expanded footer avatar:', c2);

// ─── 3. Upgrade User Menu Popup ───────────────────────────────────────────────
// استبدل الـ popup القديم بواحد أجمل مع animation
const oldPopupStart = `        <div
          style={{
            position: "fixed",
            top: userMenuPos.top,
            left: userMenuPos.left,
            width: userMenuPos.width,
            maxHeight: "calc(100vh - 16px)",
            overflowY: "auto",
            zIndex: 9999,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", padding: "6px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            <button type="button" onClick={() => { setUserMenuOpen(false); setPwDialogOpen(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-sidebar-foreground/80 hover:bg-foreground/5 transition-colors text-right">
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50" />
              <span>\u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</span>
            </button>
            <div style={{ height: "1px", background: "hsl(var(--border)/0.5)", margin: "4px 8px" }} />
            <button type="button" onClick={() => { setUserMenuOpen(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors text-right">
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c</span>
            </button>
          </div>
        </div>`;

const newPopup = `        <div
          dir="rtl"
          style={{
            position: "fixed",
            top: userMenuPos.top,
            left: userMenuPos.left,
            width: userMenuPos.width,
            zIndex: 9999,
            animation: "userMenuIn 0.18s cubic-bezier(0.34,1.56,0.64,1)",
          }}
          onClick={e => e.stopPropagation()}
        >
          <style>{\`@keyframes userMenuIn{from{opacity:0;transform:translateX(-8px) scale(0.95)}to{opacity:1;transform:translateX(0) scale(1)}}\`}</style>
          <div style={{
            background: "linear-gradient(145deg,hsl(var(--card)) 0%,hsl(var(--card)/0.96) 100%)",
            border: "1px solid hsl(var(--border)/0.6)",
            borderRadius: "14px",
            padding: "5px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6),0 4px 12px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.07)",
            backdropFilter: "blur(16px)",
            overflow: "hidden",
          }}>
            {/* User info */}
            <div style={{
              padding: "10px 12px 9px",
              marginBottom: "3px",
              background: "hsl(var(--primary)/0.06)",
              borderRadius: "10px",
              borderBottom: "1px solid hsl(var(--border)/0.35)",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <div style={{
                  width:"32px",height:"32px",borderRadius:"50%",flexShrink:0,overflow:"hidden",
                  border:"2px solid hsl(var(--primary)/0.35)",
                  boxShadow:"0 0 10px hsl(var(--primary)/0.3)",
                }}>
                  {(user as any)?.avatar
                    ? <img src={(user as any).avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" />
                    : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,hsl(var(--primary)/0.8),hsl(var(--primary)/0.4))",color:"hsl(var(--primary-foreground))",fontSize:"13px",fontWeight:"800"}}>
                        {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:"12px",fontWeight:"800",color:"hsl(var(--foreground))",marginBottom:"1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.displayName}</p>
                  <p style={{fontSize:"10px",color:"hsl(var(--muted-foreground))",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getRoleLabel(user)}</p>
                </div>
                <span style={{
                  width:"8px",height:"8px",borderRadius:"50%",background:"#34d399",flexShrink:0,
                  boxShadow:"0 0 6px rgba(52,211,153,0.9)",
                }} />
              </div>
            </div>
            {/* Change password */}
            <button type="button"
              onClick={() => { setUserMenuOpen(false); setPwDialogOpen(true); }}
              className="w-full text-right transition-all"
              style={{ display:"flex",alignItems:"center",gap:"10px",padding:"9px 10px",borderRadius:"10px",background:"transparent",border:"none",cursor:"pointer",color:"hsl(var(--sidebar-foreground)/0.8)" }}
              onMouseEnter={e=>{e.currentTarget.style.background="hsl(var(--primary)/0.1)";e.currentTarget.style.color="hsl(var(--primary))";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="hsl(var(--sidebar-foreground)/0.8)";}}
            >
              <div style={{
                width:"28px",height:"28px",borderRadius:"8px",flexShrink:0,
                background:"linear-gradient(135deg,hsl(var(--primary)/0.15),hsl(var(--primary)/0.07))",
                border:"1px solid hsl(var(--primary)/0.2)",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 2px 6px hsl(var(--primary)/0.1)",
              }}>
                <KeyRound style={{width:"13px",height:"13px",color:"hsl(var(--primary)/0.7)"}} />
              </div>
              <span style={{fontSize:"12px",fontWeight:"700"}}>\u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</span>
            </button>
            <div style={{height:"1px",background:"hsl(var(--border)/0.4)",margin:"3px 8px"}} />
            {/* Logout */}
            <button type="button"
              onClick={() => { setUserMenuOpen(false); logout(); }}
              className="w-full text-right transition-all"
              style={{ display:"flex",alignItems:"center",gap:"10px",padding:"9px 10px",borderRadius:"10px",background:"transparent",border:"none",cursor:"pointer",color:"rgba(248,113,113,0.85)" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,0.12)";e.currentTarget.style.color="rgb(252,165,165)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(248,113,113,0.85)";}}
            >
              <div style={{
                width:"28px",height:"28px",borderRadius:"8px",flexShrink:0,
                background:"linear-gradient(135deg,rgba(239,68,68,0.18),rgba(185,28,28,0.1))",
                border:"1px solid rgba(239,68,68,0.25)",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 0 8px rgba(239,68,68,0.15)",
              }}>
                <LogOut style={{width:"13px",height:"13px",color:"rgba(248,113,113,0.8)"}} />
              </div>
              <span style={{fontSize:"12px",fontWeight:"700"}}>\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c</span>
            </button>
          </div>
        </div>`;

if (content.includes(oldPopupStart)) {
  content = content.replace(oldPopupStart, newPopup);
  console.log('fix3 upgraded popup: true');
} else {
  console.log('fix3: popup not found — trying partial match');
  // partial: ابحث عن أي جزء
  const idx = content.indexOf('maxHeight: "calc(100vh - 16px)"');
  console.log('partial idx:', idx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('FILE SAVED');
