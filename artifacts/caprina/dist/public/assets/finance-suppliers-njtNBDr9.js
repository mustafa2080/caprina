import{j as e,b as De,u as se,c as U}from"./vendor-query-8HrXCEMH.js";import{u as Ee,g as ze,B as l,I as v,D as re,i as le,j as ie,k as ne,L as g,a as A}from"./index-sVDg2AHB.js";import{r as u}from"./vendor-router-D4U-j562.js";import{C as oe}from"./card-Dp5OaO0a.js";import{B as Q}from"./badge-CmztUlY_.js";import{T as Te}from"./textarea-BpRgrYx_.js";import{S as de,a as ce,b as pe,c as xe,d as H}from"./select-DNejUWrt.js";import{aw as Pe,b as Be,aa as Le,X as me,J as Oe,n as Ge,V as he,bk as ge,al as Ie,a8 as _e,x as qe,bd as Ke,a5 as Re,j as Ue,D as Qe,ai as He}from"./vendor-icons-CX9NAYBk.js";import"./vendor-ui-Crr4QZuT.js";import"./vendor-charts-DSEGUdHO.js";const S={get:n=>A(n),post:(n,N)=>A(n,{method:"POST",body:JSON.stringify(N)}),patch:(n,N)=>A(n,{method:"PATCH",body:JSON.stringify(N)}),del:n=>A(n,{method:"DELETE"})},B=[{value:"raw_materials",label:"خامات"},{value:"products",label:"منتجات جاهزة"},{value:"packaging",label:"تغليف"},{value:"services",label:"خدمات"},{value:"other",label:"أخرى"}],L={unpaid:{label:"غير مدفوع",cls:"bg-rose-500/15 text-rose-500 border-rose-500/20"},partial:{label:"جزئي",cls:"bg-amber-500/15 text-amber-500 border-amber-500/20"},paid:{label:"مدفوع",cls:"bg-emerald-500/15 text-emerald-500 border-emerald-500/20"}},O={draft:{label:"مسودة",cls:"bg-slate-500/15 text-slate-400"},ordered:{label:"مُرسَل",cls:"bg-blue-500/15 text-blue-400"},received:{label:"مُستلَم",cls:"bg-emerald-500/15 text-emerald-500"},partial_received:{label:"مستلم جزئياً",cls:"bg-amber-500/15 text-amber-500"},cancelled:{label:"ملغي",cls:"bg-red-500/15 text-red-400"}},i=n=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(n),J=12;function st(){const{isAdmin:n,can:N}=Ee();if(!n&&!N("finance.suppliers"))return e.jsxs("div",{className:"flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4",children:[e.jsx("div",{className:"w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center",children:e.jsx("span",{className:"text-3xl",children:"🔒"})}),e.jsx("h2",{className:"text-xl font-bold",children:"غير مصرح بالوصول"}),e.jsx("p",{className:"text-muted-foreground text-sm max-w-xs",children:"ليس لديك صلاحية لعرض صفحة الماليات. تواصل مع المدير."})]});const D=De(),{toast:E}=ze(),[j,M]=u.useState(""),[y,V]=u.useState("all"),[w,C]=u.useState(1),[ue,$]=u.useState(!1),[z,Y]=u.useState(null),[m,h]=u.useState({name:"",phone:"",email:"",address:"",category:"products",paymentTerms:"",notes:""}),[s,T]=u.useState(null),[p,F]=u.useState(""),[x,k]=u.useState(""),G=new URLSearchParams;j.trim()&&G.set("search",j.trim()),y!=="all"&&G.set("category",y);const{data:P=[],isLoading:be}=se({queryKey:["finance-suppliers",j,y],queryFn:()=>S.get(`/finance/suppliers?${G}`)}),I=new URLSearchParams;p&&I.set("from",p),x&&I.set("to",x);const{data:o,isLoading:fe}=se({queryKey:["supplier-statement",s?.id,p,x],queryFn:()=>S.get(`/finance/suppliers/${s.id}/statement?${I}`),enabled:!!s}),_=U({mutationFn:t=>z?S.patch(`/finance/suppliers/${z.id}`,t):S.post("/finance/suppliers",t),onSuccess:()=>{D.invalidateQueries({queryKey:["finance-suppliers"]}),$(!1),E({title:z?"تم التعديل":"تمت الإضافة"})}}),ve=U({mutationFn:t=>S.del(`/finance/suppliers/${t}`),onSuccess:()=>{D.invalidateQueries({queryKey:["finance-suppliers"]}),E({title:"تم الحذف"})}}),X=U({mutationFn:t=>A(`/finance/suppliers/${t}/set-default`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({})}),onSuccess:t=>{D.invalidateQueries({queryKey:["finance-suppliers"]}),D.invalidateQueries({queryKey:["finance-suppliers-default"]}),E({title:`✅ "${t.name}" أصبح المورد الافتراضي`})},onError:()=>E({title:"خطأ",description:"فشل تعيين المورد الافتراضي",variant:"destructive"})}),je=()=>{Y(null),h({name:"",phone:"",email:"",address:"",category:"products",paymentTerms:"",notes:""}),$(!0)},ye=t=>{Y(t),h({name:t.name,phone:t.phone??"",email:t.email??"",address:t.address??"",category:t.category??"products",paymentTerms:t.paymentTerms??"",notes:t.notes??""}),$(!0)},Ne=()=>{const t=new URLSearchParams;j.trim()&&t.set("search",j.trim()),y!=="all"&&t.set("category",y),window.open(`/api/finance/suppliers/export-excel?${t}`,"_blank")},we=()=>{if(!s)return;const t=new URLSearchParams;p&&t.set("from",p),x&&t.set("to",x),window.open(`/api/finance/suppliers/${s.id}/statement/export-excel?${t}`,"_blank")},Ce=()=>{if(!s||!o)return;const t=o.orders,{totalOrders:a,totalAmount:b,totalPaid:f,totalUnpaid:d}=o.summary,r=t.map((c,W)=>{const ee=parseFloat(c.totalAmount??"0"),te=parseFloat(c.paidAmount??"0"),ae=ee-te,Se=L[c.paymentStatus??"unpaid"]??L.unpaid,Ae=O[c.status??"draft"]??O.draft,R=c.paymentStatus==="paid"?"#0F9D58":c.paymentStatus==="partial"?"#C98A0C":"#D93025";return`<tr class="${W%2===0?"even":""}">
        <td class="num">${W+1}</td>
        <td class="po">${c.poNumber}</td>
        <td>${c.createdAt?new Date(c.createdAt).toLocaleDateString("ar-EG"):"—"}</td>
        <td><span class="badge">${Ae.label}</span></td>
        <td class="num-cell">${i(ee)}</td>
        <td class="num-cell paid">${i(te)}</td>
        <td class="num-cell due ${ae>0?"due-pos":""}">${i(ae)}</td>
        <td><span class="badge" style="background:${R}1a;color:${R};border-color:${R}55">${Se.label}</span></td>
      </tr>`}).join(""),Fe=p||x?`الفترة: ${p?new Date(p).toLocaleDateString("ar-EG"):"البداية"} ← ${x?new Date(x).toLocaleDateString("ar-EG"):"الآن"}`:"كل الفترات",ke=`<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<title>كشف حساب — ${s.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: 'Cairo', Arial, sans-serif; background: #f1f3f6; color: #1f2430; direction: rtl; }
  body { padding: 28px; }
  .sheet { max-width: 980px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(20,20,40,0.10); }

  /* ── Header ── */
  .head { background: linear-gradient(120deg, #161B33 0%, #2A2356 55%, #3B2A66 100%); color: #fff; padding: 30px 36px 26px; position: relative; overflow: hidden; }
  .head::after { content: ""; position: absolute; inset-inline-end: -60px; top: -60px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%); }
  .head-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; position: relative; z-index: 1; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-badge { width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; letter-spacing: 0.5px; }
  .brand-name { font-size: 13px; font-weight: 800; letter-spacing: 0.5px; color: rgba(255,255,255,0.92); }
  .doc-tag { font-size: 10px; font-weight: 700; padding: 5px 12px; border-radius: 999px; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.25); }
  .head h1 { font-size: 22px; font-weight: 900; margin-top: 18px; position: relative; z-index: 1; }
  .head .sub { font-size: 12px; color: rgba(255,255,255,0.65); margin-top: 4px; position: relative; z-index: 1; }
  .head-meta { margin-top: 18px; display: flex; gap: 22px; flex-wrap: wrap; position: relative; z-index: 1; font-size: 11px; color: rgba(255,255,255,0.78); }
  .head-meta b { color: #fff; font-weight: 700; }

  /* ── Supplier info strip ── */
  .info-strip { display: flex; flex-wrap: wrap; gap: 0; border-bottom: 1px solid #e7e9f0; }
  .info-cell { flex: 1; min-width: 150px; padding: 14px 20px; border-inline-end: 1px solid #eef0f5; }
  .info-cell:last-child { border-inline-end: none; }
  .info-cell .lbl { font-size: 10px; color: #8a8fa3; font-weight: 700; margin-bottom: 3px; }
  .info-cell .val { font-size: 13px; font-weight: 700; color: #1f2430; }

  /* ── Summary cards ── */
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 22px 36px 6px; }
  .stat { border-radius: 14px; padding: 16px 14px; text-align: center; border: 1px solid; position: relative; overflow: hidden; }
  .stat .stat-label { font-size: 11px; font-weight: 700; margin-bottom: 6px; opacity: 0.85; }
  .stat .stat-value { font-size: 18px; font-weight: 900; }
  .stat.c1 { background: #F4F1FC; border-color: #DCD3F5; }
  .stat.c1 .stat-label, .stat.c1 .stat-value { color: #5B3FA8; }
  .stat.c2 { background: #FFF6E9; border-color: #F6E0BC; }
  .stat.c2 .stat-label, .stat.c2 .stat-value { color: #B5790A; }
  .stat.c3 { background: #EAFAF3; border-color: #BFEBD6; }
  .stat.c3 .stat-label, .stat.c3 .stat-value { color: #0F8A53; }
  .stat.c4 { background: ${d>0?"#FDECEC":"#EAFAF3"}; border-color: ${d>0?"#F6C6C6":"#BFEBD6"}; }
  .stat.c4 .stat-label, .stat.c4 .stat-value { color: ${d>0?"#C23B3B":"#0F8A53"}; }

  /* ── Table ── */
  .table-wrap { padding: 18px 36px 8px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #161B33; color: #fff; padding: 11px 8px; font-size: 11px; font-weight: 700; text-align: center; }
  thead th:first-child { border-radius: 8px 0 0 0; }
  thead th:last-child  { border-radius: 0 8px 0 0; }
  tbody td { padding: 10px 8px; font-size: 12px; text-align: center; border-bottom: 1px solid #eef0f5; color: #2b2f3a; }
  tbody tr.even td { background: #FAFAFD; }
  td.num { color: #9aa0b4; font-size: 11px; width: 30px; }
  td.po  { font-weight: 800; color: #161B33; font-family: 'Cairo', Arial, sans-serif; }
  td.num-cell { font-weight: 700; font-variant-numeric: tabular-nums; }
  td.paid { color: #0F8A53; }
  td.due.due-pos { color: #C23B3B; font-weight: 800; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: #EEF0F7; color: #4a4f63; border: 1px solid #e2e4ee; }

  tfoot td { background: #161B33; color: #fff; font-weight: 900; font-size: 12.5px; padding: 13px 8px; }
  tfoot tr td:first-child { border-radius: 0 0 0 10px; }
  tfoot tr td:last-child  { border-radius: 0 0 10px 0; }
  tfoot .due-final { color: ${d>0?"#FF8A80":"#7FE3B4"}; }

  .empty-note { text-align: center; padding: 30px; color: #9aa0b4; font-size: 12px; }

  /* ── Footer / signatures ── */
  .footer { padding: 26px 36px 30px; display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
  .sign { text-align: center; min-width: 160px; }
  .sign .line { border-top: 1.5px solid #c9cce0; margin-top: 38px; padding-top: 6px; font-size: 11px; color: #6c7188; font-weight: 700; }
  .stamp-note { font-size: 10px; color: #b3b6c6; }

  @page { size: A4; margin: 14mm 10mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; max-width: 100%; }
    .head::after { display: none; }
  }
</style></head>
<body>
<div class="sheet">

  <div class="head">
    <div class="head-top">
      <div class="brand">
        <div class="brand-badge">CP</div>
        <div class="brand-name">Caprina<br/><span style="font-weight:400;opacity:.7">إدارة الطلبات والموردين</span></div>
      </div>
      <div class="doc-tag">كشف حساب مورد</div>
    </div>
    <h1>كشف حساب — ${s.name}</h1>
    <p class="sub">بيان تفصيلي بأوامر الشراء والمدفوعات</p>
    <div class="head-meta">
      <span>تاريخ الطباعة: <b>${new Date().toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric"})}</b></span>
      <span>${Fe}</span>
      <span>عدد الأوامر: <b>${a}</b></span>
    </div>
  </div>

  ${s.phone||s.email||s.paymentTerms||s.category?`
  <div class="info-strip">
    ${s.phone?`<div class="info-cell"><div class="lbl">الهاتف</div><div class="val">${s.phone}</div></div>`:""}
    ${s.email?`<div class="info-cell"><div class="lbl">البريد الإلكتروني</div><div class="val">${s.email}</div></div>`:""}
    ${s.category?`<div class="info-cell"><div class="lbl">الفئة</div><div class="val">${B.find(c=>c.value===s.category)?.label??s.category}</div></div>`:""}
    ${s.paymentTerms?`<div class="info-cell"><div class="lbl">شروط الدفع</div><div class="val">${s.paymentTerms}</div></div>`:""}
  </div>`:""}

  <div class="summary">
    <div class="stat c1"><div class="stat-label">إجمالي الأوامر</div><div class="stat-value">${a}</div></div>
    <div class="stat c2"><div class="stat-label">إجمالي المشتريات</div><div class="stat-value">${i(b)}</div></div>
    <div class="stat c3"><div class="stat-label">إجمالي المدفوع</div><div class="stat-value">${i(f)}</div></div>
    <div class="stat c4"><div class="stat-label">المتبقي (مديونية)</div><div class="stat-value">${i(d)}</div></div>
  </div>

  <div class="table-wrap">
    ${t.length===0?'<div class="empty-note">لا توجد أوامر شراء في هذه الفترة</div>':`
    <table>
      <thead><tr>
        <th>#</th><th>رقم الأمر</th><th>التاريخ</th><th>الحالة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>حالة الدفع</th>
      </tr></thead>
      <tbody>${r}</tbody>
      <tfoot><tr>
        <td colspan="4">الإجمالي الكلي</td>
        <td>${i(b)}</td>
        <td>${i(f)}</td>
        <td class="due-final">${i(d)}</td>
        <td></td>
      </tr></tfoot>
    </table>`}
  </div>

  <div class="footer">
    <div class="sign"><div class="line">توقيع المحاسب</div></div>
    <div class="stamp-note">تم إنشاء هذا المستند إلكترونياً عبر نظام Caprina</div>
    <div class="sign"><div class="line">توقيع واستلام المورد</div></div>
  </div>

</div>
<script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
</body></html>`,K=window.open("","_blank");K&&(K.document.write(ke),K.document.close())},q=Math.max(1,Math.ceil(P.length/J)),$e=P.slice((w-1)*J,w*J),Z=j.trim()||y!=="all";return e.jsxs("div",{className:"space-y-5 animate-in fade-in duration-500",dir:"rtl",children:[e.jsxs("div",{className:"flex items-center justify-between flex-wrap gap-3",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-bold",children:"الموردون"}),e.jsx("p",{className:"text-muted-foreground text-sm",children:"إدارة بيانات وحسابات الموردين"})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs(l,{variant:"outline",size:"sm",className:"gap-2 border-border h-9",onClick:Ne,children:[e.jsx(Pe,{className:"w-4 h-4 text-emerald-500"}),"تصدير Excel"]}),e.jsxs(l,{onClick:je,className:"gap-2 h-9",children:[e.jsx(Be,{className:"w-4 h-4"}),"مورد جديد"]})]})]}),e.jsx(oe,{className:"p-3 border-border",children:e.jsxs("div",{className:"flex flex-wrap gap-2 items-center",children:[e.jsxs("div",{className:"relative flex-1 min-w-[180px]",children:[e.jsx(Le,{className:"absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"}),e.jsx(v,{className:"h-9 text-sm pr-8",placeholder:"بحث بالاسم أو الهاتف...",value:j,onChange:t=>{M(t.target.value),C(1)}})]}),e.jsxs(de,{value:y,onValueChange:t=>{V(t),C(1)},children:[e.jsx(ce,{className:"h-9 text-sm border-border w-[150px]",children:e.jsx(pe,{placeholder:"كل الفئات"})}),e.jsxs(xe,{children:[e.jsx(H,{value:"all",children:"كل الفئات"}),B.map(t=>e.jsx(H,{value:t.value,children:t.label},t.value))]})]}),Z&&e.jsxs(l,{variant:"ghost",size:"sm",className:"h-9 gap-1.5 text-muted-foreground",onClick:()=>{M(""),V("all"),C(1)},children:[e.jsx(me,{className:"w-3.5 h-3.5"}),"مسح"]}),e.jsxs("span",{className:"text-xs text-muted-foreground mr-auto",children:[P.length," مورد"]})]})}),be?e.jsx("div",{className:"p-10 text-center text-muted-foreground",children:"جاري التحميل..."}):P.length===0?e.jsxs(oe,{className:"p-10 text-center border-border",children:[e.jsx(Oe,{className:"w-10 h-10 text-muted-foreground mx-auto mb-3"}),e.jsxs("p",{className:"text-muted-foreground",children:["لا يوجد موردون",Z?" بهذه الفلاتر":""]})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",children:$e.map(t=>{const a=parseFloat(t.balance),b=a<0?"#ef4444":"#26A69A",f=a<0?"rgba(239,68,68,0.22)":"rgba(38,166,154,0.20)",d=a<0?"linear-gradient(135deg, rgba(239,68,68,0.28) 0%, rgba(239,68,68,0.10) 52%, rgba(255,255,255,0.05) 100%)":"linear-gradient(135deg, rgba(126,87,194,0.28) 0%, rgba(126,87,194,0.10) 52%, rgba(255,255,255,0.05) 100%)";return e.jsxs("div",{role:"button",tabIndex:0,onClick:()=>{T(t),F(""),k("")},onKeyDown:r=>{r.key==="Enter"&&(T(t),F(""),k(""))},className:"group relative overflow-hidden rounded-[20px] p-4 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer",style:{background:d,border:`1px solid ${f}`,boxShadow:`inset 0 1px 0 rgba(255,255,255,0.13), 0 8px 24px ${f}`,backdropFilter:"blur(12px)"},children:[e.jsx("div",{className:"absolute inset-x-6 top-0 h-px pointer-events-none",style:{background:`linear-gradient(90deg, transparent, ${a<0?"#ef4444":"#7E57C2"}, transparent)`}}),e.jsxs("div",{className:"flex items-start justify-between gap-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"w-9 h-9 rounded-full flex items-center justify-center shrink-0",style:{background:"rgba(255,255,255,0.10)"},children:e.jsx(Ge,{className:"w-4 h-4",style:{color:a<0?"#ef4444":"#7E57C2"}})}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("p",{className:"font-bold text-sm",style:{color:"hsl(var(--foreground))"},children:t.name}),t.isDefault&&e.jsxs("span",{className:"inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold",style:{background:"rgba(255,183,77,0.2)",color:"#FFB74D",border:"1px solid rgba(255,183,77,0.4)"},children:[e.jsx(he,{className:"w-2.5 h-2.5 fill-current"}),"افتراضي"]})]}),e.jsx(Q,{variant:"outline",className:"text-[9px] mt-0.5 border-white/20 text-white/60",children:B.find(r=>r.value===t.category)?.label??t.category})]})]}),e.jsxs("div",{className:"flex gap-1",children:[e.jsx(l,{variant:"ghost",size:"icon",className:"h-7 w-7 hover:bg-amber-500/10",title:t.isDefault?"هو المورد الافتراضي":"تعيين كمورد افتراضي",disabled:X.isPending,onClick:r=>{r.stopPropagation(),t.isDefault||X.mutate(t.id)},style:{color:t.isDefault?"#FFB74D":"hsl(var(--muted-foreground)/0.4)"},children:e.jsx(he,{className:`w-3.5 h-3.5 ${t.isDefault?"fill-current":""}`})}),e.jsxs("div",{className:"flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",children:[e.jsx(l,{variant:"ghost",size:"icon",className:"h-7 w-7 text-blue-400 hover:bg-white/10",title:"كشف حساب",onClick:r=>{r.stopPropagation(),T(t),F(""),k("")},children:e.jsx(ge,{className:"w-3.5 h-3.5"})}),e.jsx(l,{variant:"ghost",size:"icon",className:"h-7 w-7 hover:bg-white/10",onClick:r=>{r.stopPropagation(),ye(t)},children:e.jsx(Ie,{className:"w-3.5 h-3.5",style:{color:"hsl(var(--muted-foreground))"}})}),e.jsx(l,{variant:"ghost",size:"icon",className:"h-7 w-7 hover:bg-rose-500/10",onClick:r=>{r.stopPropagation(),confirm(`حذف المورد "${t.name}"؟ لا يمكن التراجع عن هذا الإجراء.`)&&ve.mutate(t.id)},children:e.jsx(_e,{className:"w-3.5 h-3.5 text-rose-400"})})]})]})]}),e.jsxs("div",{className:"mt-3 space-y-1 text-xs",style:{color:"hsl(var(--muted-foreground))"},children:[t.phone&&e.jsxs("p",{className:"flex items-center gap-1.5",children:[e.jsx(qe,{className:"w-3 h-3"}),t.phone]}),t.email&&e.jsxs("p",{className:"flex items-center gap-1.5",children:[e.jsx(Ke,{className:"w-3 h-3"}),t.email]}),t.paymentTerms&&e.jsxs("p",{children:["شروط الدفع: ",e.jsx("span",{className:"font-medium",style:{color:"hsl(var(--foreground))"},children:t.paymentTerms})]}),e.jsxs("div",{className:"flex items-center justify-between pt-2 mt-2",style:{borderTop:"1px solid rgba(255,255,255,0.10)"},children:[e.jsx("span",{children:"الرصيد"}),e.jsx("span",{className:"font-bold",style:{color:b,textShadow:`0 0 10px ${b}88`},children:i(a)})]})]})]},t.id)})}),q>1&&e.jsxs("div",{className:"flex items-center justify-center gap-3 pt-2",children:[e.jsx(l,{variant:"outline",size:"icon",className:"h-8 w-8 border-border",disabled:w===1,onClick:()=>C(t=>t-1),children:e.jsx(Re,{className:"w-4 h-4"})}),e.jsxs("span",{className:"text-sm text-muted-foreground",children:[w," / ",q]}),e.jsx(l,{variant:"outline",size:"icon",className:"h-8 w-8 border-border",disabled:w===q,onClick:()=>C(t=>t+1),children:e.jsx(Ue,{className:"w-4 h-4"})})]})]}),e.jsx(re,{open:ue,onOpenChange:$,children:e.jsxs(le,{className:"bg-card border-border max-w-md",dir:"rtl",children:[e.jsx(ie,{children:e.jsx(ne,{children:z?"تعديل مورد":"مورد جديد"})}),e.jsxs("div",{className:"space-y-3 mt-2",children:[e.jsxs("div",{children:[e.jsx(g,{className:"text-xs mb-1 block",children:"اسم المورد *"}),e.jsx(v,{className:"h-9 text-sm",value:m.name,onChange:t=>h(a=>({...a,name:t.target.value}))})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx(g,{className:"text-xs mb-1 block",children:"هاتف"}),e.jsx(v,{className:"h-9 text-sm",value:m.phone,onChange:t=>h(a=>({...a,phone:t.target.value}))})]}),e.jsxs("div",{children:[e.jsx(g,{className:"text-xs mb-1 block",children:"بريد إلكتروني"}),e.jsx(v,{className:"h-9 text-sm",value:m.email,onChange:t=>h(a=>({...a,email:t.target.value}))})]})]}),e.jsxs("div",{children:[e.jsx(g,{className:"text-xs mb-1 block",children:"الفئة"}),e.jsxs(de,{value:m.category,onValueChange:t=>h(a=>({...a,category:t})),children:[e.jsx(ce,{className:"h-9 text-sm border-border",children:e.jsx(pe,{})}),e.jsx(xe,{children:B.map(t=>e.jsx(H,{value:t.value,children:t.label},t.value))})]})]}),e.jsxs("div",{children:[e.jsx(g,{className:"text-xs mb-1 block",children:"شروط الدفع"}),e.jsx(v,{className:"h-9 text-sm",placeholder:"مثال: نقداً / 30 يوم",value:m.paymentTerms,onChange:t=>h(a=>({...a,paymentTerms:t.target.value}))})]}),e.jsxs("div",{children:[e.jsx(g,{className:"text-xs mb-1 block",children:"العنوان"}),e.jsx(v,{className:"h-9 text-sm",value:m.address,onChange:t=>h(a=>({...a,address:t.target.value}))})]}),e.jsxs("div",{children:[e.jsx(g,{className:"text-xs mb-1 block",children:"ملاحظات"}),e.jsx(Te,{className:"text-sm min-h-[60px]",value:m.notes,onChange:t=>h(a=>({...a,notes:t.target.value}))})]}),e.jsxs("div",{className:"flex gap-2 pt-2",children:[e.jsx(l,{className:"flex-1 h-9 font-bold",onClick:()=>_.mutate(m),disabled:_.isPending||!m.name,children:_.isPending?"جاري الحفظ...":"حفظ"}),e.jsx(l,{variant:"outline",className:"h-9 border-border",onClick:()=>$(!1),children:"إلغاء"})]})]})]})}),e.jsx(re,{open:!!s,onOpenChange:t=>!t&&T(null),children:e.jsxs(le,{className:"bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto",dir:"rtl",children:[e.jsx(ie,{children:e.jsxs("div",{className:"flex items-center justify-between gap-3 flex-wrap",children:[e.jsxs(ne,{className:"flex items-center gap-2",children:[e.jsx(ge,{className:"w-4 h-4 text-primary"}),"كشف حساب — ",s?.name]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs(l,{variant:"outline",size:"sm",className:"gap-2 border-border h-8",onClick:we,children:[e.jsx(Qe,{className:"w-3.5 h-3.5"}),"تصدير Excel"]}),e.jsxs(l,{variant:"outline",size:"sm",className:"gap-2 border-border h-8",onClick:Ce,disabled:!o,children:[e.jsx(He,{className:"w-3.5 h-3.5"}),"طباعة"]})]})]})}),e.jsxs("div",{className:"flex gap-3 flex-wrap items-end",children:[e.jsxs("div",{children:[e.jsx(g,{className:"text-xs mb-1 block",children:"من تاريخ"}),e.jsx(v,{type:"date",className:"h-8 text-sm border-border w-36",value:p,onChange:t=>F(t.target.value)})]}),e.jsxs("div",{children:[e.jsx(g,{className:"text-xs mb-1 block",children:"إلى تاريخ"}),e.jsx(v,{type:"date",className:"h-8 text-sm border-border w-36",value:x,onChange:t=>k(t.target.value)})]}),(p||x)&&e.jsxs(l,{variant:"ghost",size:"sm",className:"h-8 gap-1.5 text-muted-foreground",onClick:()=>{F(""),k("")},children:[e.jsx(me,{className:"w-3.5 h-3.5"}),"مسح"]})]}),fe?e.jsx("div",{className:"py-8 text-center text-muted-foreground",children:"جاري التحميل..."}):o?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-3",children:[{label:"إجمالي الأوامر",value:o.summary.totalOrders,isCount:!0,color:"#7E57C2",glow:"rgba(126,87,194,0.28)",bg:"linear-gradient(135deg, rgba(126,87,194,0.42) 0%, rgba(126,87,194,0.16) 52%, rgba(255,255,255,0.08) 100%)"},{label:"إجمالي المشتريات",value:o.summary.totalAmount,color:"#FFB74D",glow:"rgba(255,183,77,0.28)",bg:"linear-gradient(135deg, rgba(255,183,77,0.42) 0%, rgba(255,183,77,0.16) 52%, rgba(255,255,255,0.08) 100%)"},{label:"المدفوع",value:o.summary.totalPaid,color:"#26A69A",glow:"rgba(38,166,154,0.28)",bg:"linear-gradient(135deg, rgba(38,166,154,0.44) 0%, rgba(38,166,154,0.16) 52%, rgba(255,255,255,0.08) 100%)"},{label:"المتبقي",value:o.summary.totalUnpaid,color:"#ef4444",glow:"rgba(239,68,68,0.28)",bg:"linear-gradient(135deg, rgba(239,68,68,0.42) 0%, rgba(239,68,68,0.16) 52%, rgba(255,255,255,0.08) 100%)"}].map(t=>e.jsxs("div",{className:"relative overflow-hidden rounded-[18px] px-4 py-3.5 text-center",style:{background:t.bg,border:`1px solid ${t.glow}`,boxShadow:`inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 24px ${t.glow}`,backdropFilter:"blur(12px)"},children:[e.jsx("div",{className:"absolute inset-x-6 top-0 h-px",style:{background:`linear-gradient(90deg, transparent, ${t.color}, transparent)`}}),e.jsx("p",{className:"text-[11px] font-bold mb-1",style:{color:"rgba(255,255,255,0.65)"},children:t.label}),e.jsx("p",{className:"font-black text-base",style:{color:t.color,textShadow:`0 0 14px ${t.color}88`},children:t.isCount?t.value:i(t.value)})]},t.label))}),o.orders.length===0?e.jsx("p",{className:"text-center text-muted-foreground py-6 text-sm",children:"لا توجد أوامر شراء في هذه الفترة"}):e.jsx("div",{className:"overflow-x-auto rounded-lg border border-border",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-border bg-muted/30",children:[e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"رقم الأمر"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"التاريخ"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"الحالة"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"الإجمالي"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"المدفوع"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"المتبقي"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"الدفع"})]})}),e.jsx("tbody",{children:o.orders.map(t=>{const a=parseFloat(t.totalAmount??"0"),b=parseFloat(t.paidAmount??"0"),f=a-b,d=L[t.paymentStatus??"unpaid"]??L.unpaid,r=O[t.status??"draft"]??O.draft;return e.jsxs("tr",{className:"border-b border-border/50 hover:bg-muted/20 transition-colors",children:[e.jsx("td",{className:"p-3 font-mono text-xs text-primary",children:t.poNumber}),e.jsx("td",{className:"p-3 text-xs text-muted-foreground",children:t.createdAt?new Date(t.createdAt).toLocaleDateString("ar-EG"):"—"}),e.jsx("td",{className:"p-3",children:e.jsx(Q,{className:`text-[10px] ${r.cls}`,children:r.label})}),e.jsx("td",{className:"p-3 font-medium",children:i(a)}),e.jsx("td",{className:"p-3 text-emerald-500",children:i(b)}),e.jsx("td",{className:`p-3 font-medium ${f>0?"text-rose-500":"text-muted-foreground"}`,children:i(f)}),e.jsx("td",{className:"p-3",children:e.jsx(Q,{className:`text-[10px] border ${d.cls}`,children:d.label})})]},t.id)})})]})})]}):null]})})]})}export{st as default};
//# sourceMappingURL=finance-suppliers-njtNBDr9.js.map
