import{j as e,b as Pe,u as ie,c as M}from"./vendor-query-8HrXCEMH.js";import{u as Te,g as Be,B as d,I as j,D as ne,i as oe,j as de,k as ce,L as f,a as z}from"./index-G2mMAUOj.js";import{r as v}from"./vendor-router-D4U-j562.js";import{C as xe}from"./card-DxrVMkn2.js";import{B as J}from"./badge-CGuYSzrR.js";import{T as Le}from"./textarea-DgitTZMr.js";import{S as me,a as pe,b as he,c as ue,d as V}from"./select-D7UIpRVo.js";import{az as Oe,b as Ge,ad as Ie,X as ge,_ as Ue,o as Re,a0 as be,bl as fe,ao as _e,ab as qe,y as Ke,be as He,a8 as Qe,k as Me,D as Je,ak as Ve}from"./vendor-icons-D3BRGt-F.js";import"./vendor-ui-BZs6Pu31.js";import"./vendor-charts-y_VJexBl.js";const E={get:c=>z(c),post:(c,$)=>z(c,{method:"POST",body:JSON.stringify($)}),patch:(c,$)=>z(c,{method:"PATCH",body:JSON.stringify($)}),del:c=>z(c,{method:"DELETE"})},O=[{value:"raw_materials",label:"خامات"},{value:"products",label:"منتجات جاهزة"},{value:"packaging",label:"تغليف"},{value:"services",label:"خدمات"},{value:"other",label:"أخرى"}],G={unpaid:{label:"غير مدفوع",cls:"bg-rose-500/15 text-rose-500 border-rose-500/20"},partial:{label:"جزئي",cls:"bg-amber-500/15 text-amber-500 border-amber-500/20"},paid:{label:"مدفوع",cls:"bg-emerald-500/15 text-emerald-500 border-emerald-500/20"}},I={draft:{label:"مسودة",cls:"bg-slate-500/15 text-slate-400"},ordered:{label:"مُرسَل",cls:"bg-blue-500/15 text-blue-400"},received:{label:"مُستلَم",cls:"bg-emerald-500/15 text-emerald-500"},partial_received:{label:"مستلم جزئياً",cls:"bg-amber-500/15 text-amber-500"},cancelled:{label:"ملغي",cls:"bg-red-500/15 text-red-400"}},l=c=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(c),Y=12;function it(){const{isAdmin:c,can:$}=Te();if(!c&&!$("finance.suppliers"))return e.jsxs("div",{className:"flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4",children:[e.jsx("div",{className:"w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center",children:e.jsx("span",{className:"text-3xl",children:"🔒"})}),e.jsx("h2",{className:"text-xl font-bold",children:"غير مصرح بالوصول"}),e.jsx("p",{className:"text-muted-foreground text-sm max-w-xs",children:"ليس لديك صلاحية لعرض صفحة الماليات. تواصل مع المدير."})]});const P=Pe(),{toast:N}=Be(),[y,X]=v.useState(""),[w,Z]=v.useState("all"),[C,F]=v.useState(1),[ve,k]=v.useState(!1),[T,W]=v.useState(null),[u,g]=v.useState({name:"",phone:"",email:"",address:"",category:"products",paymentTerms:"",notes:""}),[s,B]=v.useState(null),[m,S]=v.useState(""),[p,A]=v.useState(""),U=new URLSearchParams;y.trim()&&U.set("search",y.trim()),w!=="all"&&U.set("category",w);const{data:L=[],isLoading:je}=ie({queryKey:["finance-suppliers",y,w],queryFn:()=>E.get(`/finance/suppliers?${U}`)}),R=new URLSearchParams;m&&R.set("from",m),p&&R.set("to",p);const{data:n,isLoading:ye}=ie({queryKey:["supplier-statement",s?.id,m,p],queryFn:()=>E.get(`/finance/suppliers/${s.id}/statement?${R}`),enabled:!!s}),_=M({mutationFn:t=>T?E.patch(`/finance/suppliers/${T.id}`,t):E.post("/finance/suppliers",t),onSuccess:()=>{P.invalidateQueries({queryKey:["finance-suppliers"]}),k(!1),N({title:T?"تم التعديل":"تمت الإضافة"})}}),we=M({mutationFn:t=>E.del(`/finance/suppliers/${t}`),onSuccess:()=>{P.invalidateQueries({queryKey:["finance-suppliers"]}),N({title:"تم الحذف"})}}),ee=M({mutationFn:t=>z(`/finance/suppliers/${t}/set-default`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({})}),onSuccess:t=>{P.invalidateQueries({queryKey:["finance-suppliers"]}),P.invalidateQueries({queryKey:["finance-suppliers-default"]}),N({title:`✅ "${t.name}" أصبح المورد الافتراضي`})},onError:()=>N({title:"خطأ",description:"فشل تعيين المورد الافتراضي",variant:"destructive"})}),Ne=()=>{W(null),g({name:"",phone:"",email:"",address:"",category:"products",paymentTerms:"",notes:""}),k(!0)},$e=t=>{W(t),g({name:t.name,phone:t.phone??"",email:t.email??"",address:t.address??"",category:t.category??"products",paymentTerms:t.paymentTerms??"",notes:t.notes??""}),k(!0)},te=async(t,a)=>{const x=localStorage.getItem("caprina_token");try{const o=await fetch(t,{headers:x?{Authorization:`Bearer ${x}`}:{}});if(!o.ok){const K=await o.json().catch(()=>({}));N({title:"❌ فشل التصدير",description:K.error??`HTTP ${o.status}`,variant:"destructive"});return}const b=await o.blob(),r=URL.createObjectURL(b),h=document.createElement("a");h.href=r,h.download=a,h.click(),URL.revokeObjectURL(r)}catch(o){N({title:"❌ خطأ",description:o.message,variant:"destructive"})}},Ce=()=>{const t=new URLSearchParams;y.trim()&&t.set("search",y.trim()),w!=="all"&&t.set("category",w),te(`/api/finance/suppliers/export-excel?${t}`,`suppliers-${Date.now()}.xlsx`)},Fe=()=>{if(!s)return;const t=new URLSearchParams;m&&t.set("from",m),p&&t.set("to",p),te(`/api/finance/suppliers/${s.id}/statement/export-excel?${t}`,`supplier-statement-${s.id}-${Date.now()}.xlsx`)},ke=()=>{if(!s||!n)return;const t=n.orders,a=n.extraPayments??[],{totalOrders:x,totalAmount:o,totalPaid:b,totalExtraPaid:r,totalUnpaid:h}=n.summary,K=t.map((i,D)=>{const se=parseFloat(i.totalAmount??"0"),re=parseFloat(i.paidAmount??"0"),le=se-re,Ee=G[i.paymentStatus??"unpaid"]??G.unpaid,ze=I[i.status??"draft"]??I.draft,Q=i.paymentStatus==="paid"?"#0F9D58":i.paymentStatus==="partial"?"#C98A0C":"#D93025";return`<tr class="${D%2===0?"even":""}">
        <td class="num">${D+1}</td>
        <td class="po">${i.poNumber}</td>
        <td>${i.createdAt?new Date(i.createdAt).toLocaleDateString("ar-EG"):"—"}</td>
        <td><span class="badge">${ze.label}</span></td>
        <td class="num-cell">${l(se)}</td>
        <td class="num-cell paid">${l(re)}</td>
        <td class="num-cell due ${le>0?"due-pos":""}">${l(le)}</td>
        <td><span class="badge" style="background:${Q}1a;color:${Q};border-color:${Q}55">${Ee.label}</span></td>
      </tr>`}).join(""),Ae=m||p?`الفترة: ${m?new Date(m).toLocaleDateString("ar-EG"):"البداية"} ← ${p?new Date(p).toLocaleDateString("ar-EG"):"الآن"}`:"كل الفترات",De=`<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<title>كشف حساب — ${s.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: 'Cairo', Arial, sans-serif; background: #f1f3f6; color: #1f2430; direction: rtl; font-weight: 600; }
  body { padding: 28px; }
  .sheet { max-width: 980px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(20,20,40,0.10); }

  /* ── Header ── */
  .head { background: linear-gradient(120deg, #161B33 0%, #2A2356 55%, #3B2A66 100%); color: #fff; padding: 30px 36px 26px; position: relative; overflow: hidden; }
  .head::after { content: ""; position: absolute; inset-inline-end: -60px; top: -60px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%); }
  .head-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; position: relative; z-index: 1; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-badge { width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; letter-spacing: 0.5px; }
  .brand-name { font-size: 13px; font-weight: 800; letter-spacing: 0.5px; color: rgba(255,255,255,0.92); }
  .doc-tag { font-size: 10px; font-weight: 800; padding: 5px 12px; border-radius: 999px; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.25); }
  .head h1 { font-size: 22px; font-weight: 900; margin-top: 18px; position: relative; z-index: 1; }
  .head .sub { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.70); margin-top: 4px; position: relative; z-index: 1; }
  .head-meta { margin-top: 18px; display: flex; gap: 22px; flex-wrap: wrap; position: relative; z-index: 1; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.82); }
  .head-meta b { color: #fff; font-weight: 900; }

  /* ── Supplier info strip ── */
  .info-strip { display: flex; flex-wrap: wrap; gap: 0; border-bottom: 1px solid #e7e9f0; }
  .info-cell { flex: 1; min-width: 150px; padding: 14px 20px; border-inline-end: 1px solid #eef0f5; }
  .info-cell:last-child { border-inline-end: none; }
  .info-cell .lbl { font-size: 10px; color: #8a8fa3; font-weight: 800; margin-bottom: 3px; }
  .info-cell .val { font-size: 13px; font-weight: 800; color: #1f2430; }

  /* ── Summary cards ── */
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 22px 36px 6px; }
  .stat { border-radius: 14px; padding: 16px 14px; text-align: center; border: 1px solid; position: relative; overflow: hidden; }
  .stat .stat-label { font-size: 11px; font-weight: 800; margin-bottom: 6px; opacity: 0.9; }
  .stat .stat-value { font-size: 19px; font-weight: 900; }
  .stat.c1 { background: #F4F1FC; border-color: #DCD3F5; }
  .stat.c1 .stat-label, .stat.c1 .stat-value { color: #5B3FA8; }
  .stat.c2 { background: #FFF6E9; border-color: #F6E0BC; }
  .stat.c2 .stat-label, .stat.c2 .stat-value { color: #B5790A; }
  .stat.c3 { background: #EAFAF3; border-color: #BFEBD6; }
  .stat.c3 .stat-label, .stat.c3 .stat-value { color: #0F8A53; }
  .stat.c4 { background: ${h>0?"#FDECEC":"#EAFAF3"}; border-color: ${h>0?"#F6C6C6":"#BFEBD6"}; }
  .stat.c4 .stat-label, .stat.c4 .stat-value { color: ${h>0?"#C23B3B":"#0F8A53"}; }

  /* ── Table ── */
  .table-wrap { padding: 18px 36px 8px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #161B33; color: #fff; padding: 11px 8px; font-size: 11.5px; font-weight: 800; text-align: center; }
  thead th:first-child { border-radius: 8px 0 0 0; }
  thead th:last-child  { border-radius: 0 8px 0 0; }
  tbody td { padding: 10px 8px; font-size: 12.5px; font-weight: 700; text-align: center; border-bottom: 1px solid #eef0f5; color: #2b2f3a; }
  tbody tr.even td { background: #FAFAFD; }
  td.num { color: #9aa0b4; font-size: 11px; font-weight: 700; width: 30px; }
  td.po  { font-weight: 900; color: #161B33; font-family: 'Cairo', Arial, sans-serif; }
  td.num-cell { font-weight: 800; font-variant-numeric: tabular-nums; }
  td.paid { color: #0F8A53; font-weight: 800; }
  td.due.due-pos { color: #C23B3B; font-weight: 900; }
  .badge { display: inline-block; font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px; background: #EEF0F7; color: #4a4f63; border: 1px solid #e2e4ee; }

  tfoot td { background: #161B33; color: #fff; font-weight: 900; font-size: 13px; padding: 13px 8px; }
  tfoot tr td:first-child { border-radius: 0 0 0 10px; }
  tfoot tr td:last-child  { border-radius: 0 0 10px 0; }
  tfoot .due-final { color: ${h>0?"#FF8A80":"#7FE3B4"}; }

  .empty-note { text-align: center; padding: 30px; color: #9aa0b4; font-size: 12px; font-weight: 700; }

  /* ── Footer / signatures ── */
  .footer { padding: 26px 36px 30px; display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
  .sign { text-align: center; min-width: 160px; }
  .sign .line { border-top: 1.5px solid #c9cce0; margin-top: 38px; padding-top: 6px; font-size: 11px; color: #6c7188; font-weight: 800; }
  .stamp-note { font-size: 10px; font-weight: 700; color: #b3b6c6; }

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
      <span>${Ae}</span>
      <span>عدد الأوامر: <b>${x}</b></span>
    </div>
  </div>

  ${s.phone||s.email||s.paymentTerms||s.category?`
  <div class="info-strip">
    ${s.phone?`<div class="info-cell"><div class="lbl">الهاتف</div><div class="val">${s.phone}</div></div>`:""}
    ${s.email?`<div class="info-cell"><div class="lbl">البريد الإلكتروني</div><div class="val">${s.email}</div></div>`:""}
    ${s.category?`<div class="info-cell"><div class="lbl">الفئة</div><div class="val">${O.find(i=>i.value===s.category)?.label??s.category}</div></div>`:""}
    ${s.paymentTerms?`<div class="info-cell"><div class="lbl">شروط الدفع</div><div class="val">${s.paymentTerms}</div></div>`:""}
  </div>`:""}

  <div class="summary">
    <div class="stat c1"><div class="stat-label">إجمالي الأوامر</div><div class="stat-value">${x}</div></div>
    <div class="stat c2"><div class="stat-label">إجمالي المشتريات</div><div class="stat-value">${l(o)}</div></div>
    <div class="stat c3"><div class="stat-label">إجمالي المدفوع</div><div class="stat-value">${l(b)}</div></div>
    <div class="stat c4"><div class="stat-label">المتبقي (مديونية)</div><div class="stat-value">${l(h)}</div></div>
  </div>

  <div class="table-wrap">
    ${t.length===0?'<div class="empty-note">لا توجد أوامر شراء في هذه الفترة</div>':`
    <table>
      <thead><tr>
        <th>#</th><th>رقم الأمر</th><th>التاريخ</th><th>الحالة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>حالة الدفع</th>
      </tr></thead>
      <tbody>${K}</tbody>
      <tfoot><tr>
        <td colspan="4">الإجمالي الكلي</td>
        <td>${l(o)}</td>
        <td>${l(b)}</td>
        <td class="due-final">${l(h)}</td>
        <td></td>
      </tr></tfoot>
    </table>`}
  </div>

  ${a.length>0?`
  <div class="table-wrap" style="padding-top:4px;">
    <div style="font-size:12px;font-weight:800;color:#4a4f63;margin-bottom:10px;">
      دفعات إضافية (خارج أوامر الشراء) — إجمالي ${l(r)}
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>التاريخ</th><th>الوصف</th><th>المبلغ</th>
      </tr></thead>
      <tbody>
        ${a.map((i,D)=>`<tr class="${D%2===0?"even":""}">
          <td class="num">${D+1}</td>
          <td>${i.createdAt?new Date(i.createdAt).toLocaleDateString("ar-EG"):"—"}</td>
          <td>${i.title??i.notes??"دفعة لمورد"}</td>
          <td class="num-cell paid">${l(parseFloat(i.amount??"0"))}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`:""}

  <div class="footer">
    <div class="sign"><div class="line">توقيع المحاسب</div></div>
    <div class="stamp-note">تم إنشاء هذا المستند إلكترونياً عبر نظام Caprina</div>
    <div class="sign"><div class="line">توقيع واستلام المورد</div></div>
  </div>

</div>
<script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
</body></html>`,H=window.open("","_blank");H&&(H.document.write(De),H.document.close())},q=Math.max(1,Math.ceil(L.length/Y)),Se=L.slice((C-1)*Y,C*Y),ae=y.trim()||w!=="all";return e.jsxs("div",{className:"space-y-5 animate-in fade-in duration-500",dir:"rtl",children:[e.jsxs("div",{className:"flex items-center justify-between flex-wrap gap-3",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-bold",children:"الموردون"}),e.jsx("p",{className:"text-muted-foreground text-sm",children:"إدارة بيانات وحسابات الموردين"})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs(d,{variant:"outline",size:"sm",className:"gap-2 border-border h-9",onClick:Ce,children:[e.jsx(Oe,{className:"w-4 h-4 text-emerald-500"}),"تصدير Excel"]}),e.jsxs(d,{onClick:Ne,className:"gap-2 h-9",children:[e.jsx(Ge,{className:"w-4 h-4"}),"مورد جديد"]})]})]}),e.jsx(xe,{className:"p-3 border-border",children:e.jsxs("div",{className:"flex flex-wrap gap-2 items-center",children:[e.jsxs("div",{className:"relative flex-1 min-w-[180px]",children:[e.jsx(Ie,{className:"absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"}),e.jsx(j,{className:"h-9 text-sm pr-8",placeholder:"بحث بالاسم أو الهاتف...",value:y,onChange:t=>{X(t.target.value),F(1)}})]}),e.jsxs(me,{value:w,onValueChange:t=>{Z(t),F(1)},children:[e.jsx(pe,{className:"h-9 text-sm border-border w-[150px]",children:e.jsx(he,{placeholder:"كل الفئات"})}),e.jsxs(ue,{children:[e.jsx(V,{value:"all",children:"كل الفئات"}),O.map(t=>e.jsx(V,{value:t.value,children:t.label},t.value))]})]}),ae&&e.jsxs(d,{variant:"ghost",size:"sm",className:"h-9 gap-1.5 text-muted-foreground",onClick:()=>{X(""),Z("all"),F(1)},children:[e.jsx(ge,{className:"w-3.5 h-3.5"}),"مسح"]}),e.jsxs("span",{className:"text-xs text-muted-foreground mr-auto",children:[L.length," مورد"]})]})}),je?e.jsx("div",{className:"p-10 text-center text-muted-foreground",children:"جاري التحميل..."}):L.length===0?e.jsxs(xe,{className:"p-10 text-center border-border",children:[e.jsx(Ue,{className:"w-10 h-10 text-muted-foreground mx-auto mb-3"}),e.jsxs("p",{className:"text-muted-foreground",children:["لا يوجد موردون",ae?" بهذه الفلاتر":""]})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",children:Se.map(t=>{const a=parseFloat(t.balance),x=a<0?"#ef4444":"#26A69A",o=a<0?"rgba(239,68,68,0.22)":"rgba(38,166,154,0.20)",b=a<0?"linear-gradient(135deg, rgba(239,68,68,0.28) 0%, rgba(239,68,68,0.10) 52%, rgba(255,255,255,0.05) 100%)":"linear-gradient(135deg, rgba(126,87,194,0.28) 0%, rgba(126,87,194,0.10) 52%, rgba(255,255,255,0.05) 100%)";return e.jsxs("div",{role:"button",tabIndex:0,onClick:()=>{B(t),S(""),A("")},onKeyDown:r=>{r.key==="Enter"&&(B(t),S(""),A(""))},className:"group relative overflow-hidden rounded-[20px] p-4 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer",style:{background:b,border:`1px solid ${o}`,boxShadow:`inset 0 1px 0 rgba(255,255,255,0.13), 0 8px 24px ${o}`,backdropFilter:"blur(12px)"},children:[e.jsx("div",{className:"absolute inset-x-6 top-0 h-px pointer-events-none",style:{background:`linear-gradient(90deg, transparent, ${a<0?"#ef4444":"#7E57C2"}, transparent)`}}),e.jsxs("div",{className:"flex items-start justify-between gap-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"w-9 h-9 rounded-full flex items-center justify-center shrink-0",style:{background:"rgba(255,255,255,0.10)"},children:e.jsx(Re,{className:"w-4 h-4",style:{color:a<0?"#ef4444":"#7E57C2"}})}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("p",{className:"font-bold text-sm",style:{color:"hsl(var(--foreground))"},children:t.name}),t.isDefault&&e.jsxs("span",{className:"inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold",style:{background:"rgba(255,183,77,0.2)",color:"#FFB74D",border:"1px solid rgba(255,183,77,0.4)"},children:[e.jsx(be,{className:"w-2.5 h-2.5 fill-current"}),"افتراضي"]})]}),e.jsx(J,{variant:"outline",className:"text-[9px] mt-0.5 border-white/20 text-white/60",children:O.find(r=>r.value===t.category)?.label??t.category})]})]}),e.jsxs("div",{className:"flex gap-1",children:[e.jsx(d,{variant:"ghost",size:"icon",className:"h-7 w-7 hover:bg-amber-500/10",title:t.isDefault?"هو المورد الافتراضي":"تعيين كمورد افتراضي",disabled:ee.isPending,onClick:r=>{r.stopPropagation(),t.isDefault||ee.mutate(t.id)},style:{color:t.isDefault?"#FFB74D":"hsl(var(--muted-foreground)/0.4)"},children:e.jsx(be,{className:`w-3.5 h-3.5 ${t.isDefault?"fill-current":""}`})}),e.jsxs("div",{className:"flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",children:[e.jsx(d,{variant:"ghost",size:"icon",className:"h-7 w-7 text-blue-400 hover:bg-white/10",title:"كشف حساب",onClick:r=>{r.stopPropagation(),B(t),S(""),A("")},children:e.jsx(fe,{className:"w-3.5 h-3.5"})}),e.jsx(d,{variant:"ghost",size:"icon",className:"h-7 w-7 hover:bg-white/10",onClick:r=>{r.stopPropagation(),$e(t)},children:e.jsx(_e,{className:"w-3.5 h-3.5",style:{color:"hsl(var(--muted-foreground))"}})}),e.jsx(d,{variant:"ghost",size:"icon",className:"h-7 w-7 hover:bg-rose-500/10",onClick:r=>{r.stopPropagation(),confirm(`حذف المورد "${t.name}"؟ لا يمكن التراجع عن هذا الإجراء.`)&&we.mutate(t.id)},children:e.jsx(qe,{className:"w-3.5 h-3.5 text-rose-400"})})]})]})]}),e.jsxs("div",{className:"mt-3 space-y-1 text-xs",style:{color:"hsl(var(--muted-foreground))"},children:[t.phone&&e.jsxs("p",{className:"flex items-center gap-1.5",children:[e.jsx(Ke,{className:"w-3 h-3"}),t.phone]}),t.email&&e.jsxs("p",{className:"flex items-center gap-1.5",children:[e.jsx(He,{className:"w-3 h-3"}),t.email]}),t.paymentTerms&&e.jsxs("p",{children:["شروط الدفع: ",e.jsx("span",{className:"font-medium",style:{color:"hsl(var(--foreground))"},children:t.paymentTerms})]}),e.jsxs("div",{className:"flex items-center justify-between pt-2 mt-2",style:{borderTop:"1px solid rgba(255,255,255,0.10)"},children:[e.jsx("span",{children:"الرصيد"}),e.jsx("span",{className:"font-bold",style:{color:x,textShadow:`0 0 10px ${x}88`},children:l(a)})]})]})]},t.id)})}),q>1&&e.jsxs("div",{className:"flex items-center justify-center gap-3 pt-2",children:[e.jsx(d,{variant:"outline",size:"icon",className:"h-8 w-8 border-border",disabled:C===1,onClick:()=>F(t=>t-1),children:e.jsx(Qe,{className:"w-4 h-4"})}),e.jsxs("span",{className:"text-sm text-muted-foreground",children:[C," / ",q]}),e.jsx(d,{variant:"outline",size:"icon",className:"h-8 w-8 border-border",disabled:C===q,onClick:()=>F(t=>t+1),children:e.jsx(Me,{className:"w-4 h-4"})})]})]}),e.jsx(ne,{open:ve,onOpenChange:k,children:e.jsxs(oe,{className:"bg-card border-border max-w-md",dir:"rtl",children:[e.jsx(de,{children:e.jsx(ce,{children:T?"تعديل مورد":"مورد جديد"})}),e.jsxs("div",{className:"space-y-3 mt-2",children:[e.jsxs("div",{children:[e.jsx(f,{className:"text-xs mb-1 block",children:"اسم المورد *"}),e.jsx(j,{className:"h-9 text-sm",value:u.name,onChange:t=>g(a=>({...a,name:t.target.value}))})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx(f,{className:"text-xs mb-1 block",children:"هاتف"}),e.jsx(j,{className:"h-9 text-sm",value:u.phone,onChange:t=>g(a=>({...a,phone:t.target.value}))})]}),e.jsxs("div",{children:[e.jsx(f,{className:"text-xs mb-1 block",children:"بريد إلكتروني"}),e.jsx(j,{className:"h-9 text-sm",value:u.email,onChange:t=>g(a=>({...a,email:t.target.value}))})]})]}),e.jsxs("div",{children:[e.jsx(f,{className:"text-xs mb-1 block",children:"الفئة"}),e.jsxs(me,{value:u.category,onValueChange:t=>g(a=>({...a,category:t})),children:[e.jsx(pe,{className:"h-9 text-sm border-border",children:e.jsx(he,{})}),e.jsx(ue,{children:O.map(t=>e.jsx(V,{value:t.value,children:t.label},t.value))})]})]}),e.jsxs("div",{children:[e.jsx(f,{className:"text-xs mb-1 block",children:"شروط الدفع"}),e.jsx(j,{className:"h-9 text-sm",placeholder:"مثال: نقداً / 30 يوم",value:u.paymentTerms,onChange:t=>g(a=>({...a,paymentTerms:t.target.value}))})]}),e.jsxs("div",{children:[e.jsx(f,{className:"text-xs mb-1 block",children:"العنوان"}),e.jsx(j,{className:"h-9 text-sm",value:u.address,onChange:t=>g(a=>({...a,address:t.target.value}))})]}),e.jsxs("div",{children:[e.jsx(f,{className:"text-xs mb-1 block",children:"ملاحظات"}),e.jsx(Le,{className:"text-sm min-h-[60px]",value:u.notes,onChange:t=>g(a=>({...a,notes:t.target.value}))})]}),e.jsxs("div",{className:"flex gap-2 pt-2",children:[e.jsx(d,{className:"flex-1 h-9 font-bold",onClick:()=>_.mutate(u),disabled:_.isPending||!u.name,children:_.isPending?"جاري الحفظ...":"حفظ"}),e.jsx(d,{variant:"outline",className:"h-9 border-border",onClick:()=>k(!1),children:"إلغاء"})]})]})]})}),e.jsx(ne,{open:!!s,onOpenChange:t=>!t&&B(null),children:e.jsxs(oe,{className:"bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto",dir:"rtl",children:[e.jsx(de,{children:e.jsxs("div",{className:"flex items-center justify-between gap-3 flex-wrap",children:[e.jsxs(ce,{className:"flex items-center gap-2",children:[e.jsx(fe,{className:"w-4 h-4 text-primary"}),"كشف حساب — ",s?.name]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs(d,{variant:"outline",size:"sm",className:"gap-2 border-border h-8",onClick:Fe,children:[e.jsx(Je,{className:"w-3.5 h-3.5"}),"تصدير Excel"]}),e.jsxs(d,{variant:"outline",size:"sm",className:"gap-2 border-border h-8",onClick:ke,disabled:!n,children:[e.jsx(Ve,{className:"w-3.5 h-3.5"}),"طباعة"]})]})]})}),e.jsxs("div",{className:"flex gap-3 flex-wrap items-end",children:[e.jsxs("div",{children:[e.jsx(f,{className:"text-xs mb-1 block",children:"من تاريخ"}),e.jsx(j,{type:"date",className:"h-8 text-sm border-border w-36",value:m,onChange:t=>S(t.target.value)})]}),e.jsxs("div",{children:[e.jsx(f,{className:"text-xs mb-1 block",children:"إلى تاريخ"}),e.jsx(j,{type:"date",className:"h-8 text-sm border-border w-36",value:p,onChange:t=>A(t.target.value)})]}),(m||p)&&e.jsxs(d,{variant:"ghost",size:"sm",className:"h-8 gap-1.5 text-muted-foreground",onClick:()=>{S(""),A("")},children:[e.jsx(ge,{className:"w-3.5 h-3.5"}),"مسح"]})]}),ye?e.jsx("div",{className:"py-8 text-center text-muted-foreground",children:"جاري التحميل..."}):n?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-3",children:[{label:"إجمالي الأوامر",value:n.summary.totalOrders,isCount:!0,color:"#7E57C2",glow:"rgba(126,87,194,0.28)",bg:"linear-gradient(135deg, rgba(126,87,194,0.42) 0%, rgba(126,87,194,0.16) 52%, rgba(255,255,255,0.08) 100%)"},{label:"إجمالي المشتريات",value:n.summary.totalAmount,color:"#FFB74D",glow:"rgba(255,183,77,0.28)",bg:"linear-gradient(135deg, rgba(255,183,77,0.42) 0%, rgba(255,183,77,0.16) 52%, rgba(255,255,255,0.08) 100%)"},{label:"المدفوع",value:n.summary.totalPaid,color:"#26A69A",glow:"rgba(38,166,154,0.28)",bg:"linear-gradient(135deg, rgba(38,166,154,0.44) 0%, rgba(38,166,154,0.16) 52%, rgba(255,255,255,0.08) 100%)"},{label:"المتبقي",value:n.summary.totalUnpaid,color:"#ef4444",glow:"rgba(239,68,68,0.28)",bg:"linear-gradient(135deg, rgba(239,68,68,0.42) 0%, rgba(239,68,68,0.16) 52%, rgba(255,255,255,0.08) 100%)"}].map(t=>e.jsxs("div",{className:"relative overflow-hidden rounded-[18px] px-4 py-3.5 text-center",style:{background:t.bg,border:`1px solid ${t.glow}`,boxShadow:`inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 24px ${t.glow}`,backdropFilter:"blur(12px)"},children:[e.jsx("div",{className:"absolute inset-x-6 top-0 h-px",style:{background:`linear-gradient(90deg, transparent, ${t.color}, transparent)`}}),e.jsx("p",{className:"text-[11px] font-bold mb-1",style:{color:"rgba(255,255,255,0.65)"},children:t.label}),e.jsx("p",{className:"font-black text-base",style:{color:t.color,textShadow:`0 0 14px ${t.color}88`},children:t.isCount?t.value:l(t.value)})]},t.label))}),n.orders.length===0?e.jsx("p",{className:"text-center text-muted-foreground py-6 text-sm",children:"لا توجد أوامر شراء في هذه الفترة"}):e.jsx("div",{className:"overflow-x-auto rounded-lg border border-border",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-border bg-muted/30",children:[e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"رقم الأمر"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"التاريخ"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"الحالة"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"الإجمالي"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"المدفوع"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"المتبقي"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"الدفع"})]})}),e.jsx("tbody",{children:n.orders.map(t=>{const a=parseFloat(t.totalAmount??"0"),x=parseFloat(t.paidAmount??"0"),o=a-x,b=G[t.paymentStatus??"unpaid"]??G.unpaid,r=I[t.status??"draft"]??I.draft;return e.jsxs("tr",{className:"border-b border-border/50 hover:bg-muted/20 transition-colors",children:[e.jsx("td",{className:"p-3 font-mono text-xs text-primary",children:t.poNumber}),e.jsx("td",{className:"p-3 text-xs text-muted-foreground",children:t.createdAt?new Date(t.createdAt).toLocaleDateString("ar-EG"):"—"}),e.jsx("td",{className:"p-3",children:e.jsx(J,{className:`text-[10px] ${r.cls}`,children:r.label})}),e.jsx("td",{className:"p-3 font-medium",children:l(a)}),e.jsx("td",{className:"p-3 text-emerald-500",children:l(x)}),e.jsx("td",{className:`p-3 font-medium ${o>0?"text-rose-500":"text-muted-foreground"}`,children:l(o)}),e.jsx("td",{className:"p-3",children:e.jsx(J,{className:`text-[10px] border ${b.cls}`,children:b.label})})]},t.id)})})]})}),(n.extraPayments?.length??0)>0&&e.jsxs("div",{className:"space-y-2",children:[e.jsxs("p",{className:"text-xs font-bold text-muted-foreground",children:["دفعات إضافية (خارج أوامر الشراء) — إجمالي ",l(n.summary.totalExtraPaid??0)]}),e.jsx("div",{className:"overflow-x-auto rounded-lg border border-border",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-border bg-muted/30",children:[e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"التاريخ"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"الوصف"}),e.jsx("th",{className:"text-right p-3 text-xs font-medium text-muted-foreground",children:"المبلغ"})]})}),e.jsx("tbody",{children:(n.extraPayments??[]).map(t=>e.jsxs("tr",{className:"border-b border-border/50 hover:bg-muted/20 transition-colors",children:[e.jsx("td",{className:"p-3 text-xs text-muted-foreground",children:t.createdAt?new Date(t.createdAt).toLocaleDateString("ar-EG"):"—"}),e.jsx("td",{className:"p-3 text-xs",children:t.title??t.notes??"دفعة لمورد"}),e.jsx("td",{className:"p-3 text-emerald-500 font-medium",children:l(parseFloat(t.amount??"0"))})]},t.id))})]})})]})]}):null]})})]})}export{it as default};
//# sourceMappingURL=finance-suppliers-Dy7oCRNs.js.map
