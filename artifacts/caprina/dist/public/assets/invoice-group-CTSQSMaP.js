import{b as ve,u as H,j as e}from"./vendor-query-Bj6efJQO.js";import{h as Ne,u as we,r as b,L as k}from"./vendor-router-D4U-j562.js";import{i as Se,d as $e,u as Ce,B as u,a as Pe,m as Ae}from"./index-DIpZTy1F.js";import{b as De,g as K,c as ke}from"./api-Bjeu5zzW.js";import{B as E}from"./badge-BMjA2lhB.js";import{C as R,c as U,a as Ee,b as Fe}from"./card-Bmule-B5.js";import{S as qe}from"./separator-BZbtVr2o.js";import{S as Te,a as Ie,c as Qe,d as j}from"./select-CCG8pPAk.js";import{A as W,a as J,b as V,c as Y,d as X,e as Z,f as ee,g as te}from"./alert-dialog-J7qHvoGl.js";import{S as C,a as se,W as ze}from"./whatsapp-dialog-DU_hpIsb.js";import{x as ae,a1 as Be,L as Ge,H as Le,a7 as _e,i as Oe,Q as Me,a2 as He,a3 as re,P as Ke}from"./vendor-icons-029KCsQ5.js";import{f as ie}from"./format-m39B13ny.js";import"./vendor-ui-Cz2Nrdoo.js";import"./vendor-charts-COgId5Vr.js";import"./textarea-BFvqCGsJ.js";import"./whatsapp-CkJIob2L.js";const y=P=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(P);function dt(){const{brand:P}=Se(),ne=Ne(),r=decodeURIComponent(ne.invoiceNumber??""),[,le]=we(),v=ve(),{toast:m}=$e(),{isAdmin:de}=Ce(),F=De(),[oe,N]=b.useState(!1),[q,T]=b.useState(!1),[h,w]=b.useState(null),[S,I]=b.useState(!1),[f,Q]=b.useState(null),{data:s,isLoading:ce,error:z}=H({queryKey:["invoice-group",r],queryFn:()=>Pe(`/orders/by-invoice/${encodeURIComponent(r)}`),enabled:!!r,staleTime:0,retry:3,retryDelay:1e3}),{data:me}=H({queryKey:["invoice-manifest-status",r],queryFn:()=>Ae.getInvoiceManifestStatus(r),enabled:!!r,staleTime:0}),x=me?.find(t=>t.manifestStatus==="open"),o=!!x,B=()=>{v.invalidateQueries({queryKey:K()}),v.invalidateQueries({queryKey:ke()}),v.invalidateQueries({queryKey:["invoice-group",r]})},ue=async t=>{if(!s?.length)return;if(o){m({title:"⛔ لا يمكن تعديل حالة الطلب",description:`هذه الفاتورة مرتبطة ببيان شحن مفتوح (${x?.manifestNumber}). يجب تعديل حالة الطلبات من داخل البيان في قسم شركات الشحن فقط.`,variant:"destructive"}),w(null);return}I(!0);let a=0;for(const l of s)try{await new Promise((n,c)=>{F.mutate({id:l.id,data:{status:t}},{onSuccess:()=>n(),onError:()=>c()})}),a++}catch{}B(),w(null),I(!1),m({title:`تم تحديث ${a} طلب ✅`,description:`الحالة: ${C[t]??t}`})},xe=async()=>{if(s?.length){if(o){m({title:"⛔ لا يمكن حذف الطلبات",description:`هذه الفاتورة مرتبطة ببيان شحن مفتوح (${x?.manifestNumber}). لا يمكن حذف الطلبات إلا بعد إغلاق البيان من قسم شركات الشحن.`,variant:"destructive"}),N(!1);return}T(!0);try{const t=localStorage.getItem("caprina_token"),a=s.map(c=>c.id),n=await(await fetch("/api/orders/bulk",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({ids:a})})).json();await v.refetchQueries({queryKey:K()}),m({title:`تم حذف ${n.deleted} طلب ✅`}),le("/orders")}catch{m({title:"خطأ",description:"فشل الحذف",variant:"destructive"})}finally{T(!1),N(!1)}}},pe=()=>{if(!s?.length)return;const t=s[0],a=s.reduce((d,g)=>d+g.quantity,0),l=s.reduce((d,g)=>d+g.totalPrice,0),n=t.shippingCost??0,c=P.name||"CAPRINA",je=ie(new Date(t.createdAt),"yyyy/MM/dd HH:mm"),ye=s.map((d,g)=>`
      <tr>
        <td>${g+1}</td>
        <td class="name">${d.product}</td>
        <td>${[d.color,d.size].filter(Boolean).join(" / ")||"-"}</td>
        <td>${d.quantity}</td>
        <td>${y(d.unitPrice)}</td>
        <td>${y(d.totalPrice)}</td>
      </tr>
    `).join(""),p=window.open("","_blank");p&&(p.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>فاتورة ${r}</title>
  <style>
    body { font-family: Arial, Tahoma, sans-serif; margin: 0; padding: 24px; color: #111; background: #fff; }
    .sheet { max-width: 900px; margin: 0 auto; border: 1px solid #ddd; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 16px; }
    .brand { font-size: 28px; font-weight: 800; }
    .muted { color: #666; font-size: 13px; }
    .title { font-size: 24px; font-weight: 800; margin: 0 0 8px; }
    .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; margin-bottom: 20px; }
    .meta-item { font-size: 14px; }
    .meta-item b { display: inline-block; min-width: 88px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: center; font-size: 14px; }
    th { background: #111; color: #fff; }
    td.name { text-align: right; font-weight: 700; }
    .totals { width: 320px; margin-right: auto; }
    .totals-row { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 8px 0; font-size: 14px; }
    .totals-row.total { font-size: 18px; font-weight: 800; border-bottom: 2px solid #111; }
    @media print {
      body { padding: 0; }
      .sheet { border: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="brand">${c}</div>
        <div class="muted">فاتورة رقم: ${r}</div>
        <div class="muted">${je}</div>
      </div>
      <div>
        <h1 class="title">فاتورة العميل</h1>
        <div class="muted">${s.length} منتجات / ${a} قطعة</div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-item"><b>العميل:</b> ${t.customerName||"-"}</div>
      <div class="meta-item"><b>الهاتف:</b> ${t.phone||"-"}</div>
      <div class="meta-item"><b>المحافظة:</b> ${t.city||"-"}</div>
      <div class="meta-item"><b>العنوان:</b> ${t.address||"-"}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>المنتج</th>
          <th>اللون / المقاس</th>
          <th>الكمية</th>
          <th>سعر الوحدة</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${ye}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>إجمالي المنتجات</span><b>${y(l)}</b></div>
      <div class="totals-row"><span>الشحن</span><b>${y(n)}</b></div>
      <div class="totals-row total"><span>الإجمالي الكلي</span><b>${y(l+n)}</b></div>
    </div>
  </div>
</body>
</html>`),p.document.close(),p.onload=()=>{setTimeout(()=>{p.focus(),p.print()},400)})},he=()=>{if(!s?.length)return;const t=s[0];Q({id:t.id,customerName:t.customerName,product:s.map(a=>`${a.product}×${a.quantity}`).join("، "),quantity:s.reduce((a,l)=>a+l.quantity,0),totalPrice:s.reduce((a,l)=>a+l.totalPrice,0),status:t.status,phone:t.phone})},fe=async(t,a)=>{if(!s?.length)return;if(s.some(n=>n.status==="pending")){for(const n of s)n.status==="pending"&&await new Promise(c=>{F.mutate({id:n.id,data:{status:"warehouse_ready"}},{onSuccess:()=>c(),onError:()=>c()})});B(),m({title:"تم إرسال واتساب ✅",description:"تم تحويل الطلبات لـ «قيد الشحن في المخزن»"})}else m({title:"تم فتح واتساب ✅",description:"الرسالة جاهزة للإرسال"})};if(ce)return e.jsx("div",{className:"p-12 text-center text-muted-foreground animate-pulse",children:"جاري التحميل..."});if(z)return e.jsxs("div",{className:"p-12 text-center",children:[e.jsx(ae,{className:"w-12 h-12 mx-auto mb-3 text-destructive opacity-50"}),e.jsx("h2",{className:"text-lg font-bold mb-2",children:"حدث خطأ في تحميل الفاتورة"}),e.jsx("p",{className:"text-sm text-muted-foreground mb-3",children:z?.message||"تعذر الاتصال بالسيرفر"}),e.jsxs("p",{className:"text-xs text-muted-foreground mb-4 font-mono bg-muted/20 p-2 rounded",children:["رقم الفاتورة: ",r||"(فارغ)"]}),e.jsxs("div",{className:"flex gap-2 justify-center",children:[e.jsx(u,{variant:"outline",onClick:()=>window.location.reload(),children:"إعادة المحاولة"}),e.jsx(k,{href:"/orders",children:e.jsx(u,{variant:"outline",children:"العودة للطلبات"})})]})]});if(!s?.length)return e.jsxs("div",{className:"p-12 text-center",children:[e.jsx(ae,{className:"w-12 h-12 mx-auto mb-3 text-destructive opacity-50"}),e.jsx("h2",{className:"text-lg font-bold mb-2",children:"الفاتورة غير موجودة"}),e.jsxs("p",{className:"text-sm text-muted-foreground mb-3",children:["رقم الفاتورة: ",r]}),e.jsx(k,{href:"/orders",children:e.jsx(u,{variant:"outline",className:"mt-3",children:"العودة للطلبات"})})]});const i=s[0],A=t=>t.status==="partial_received"&&t.partialQuantity!=null&&t.unitPrice!=null?Math.round(t.unitPrice*t.partialQuantity):t.totalPrice,G=s.reduce((t,a)=>t+A(a),0),L=s.reduce((t,a)=>t+a.totalPrice,0),_=s.reduce((t,a)=>t+a.quantity,0),ge=s.reduce((t,a)=>t+(a.status==="partial_received"&&a.partialQuantity!=null?a.partialQuantity:a.quantity),0),O=s.some(t=>t.status==="partial_received"),M=i.shippingCost??0,be=s.every(t=>t.status===i.status),D=i.status,$=s.some(t=>t.status==="received"||t.status==="partial_received")&&!de;return e.jsxs("div",{className:"max-w-4xl mx-auto space-y-5 animate-in fade-in duration-500",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(k,{href:"/orders",children:e.jsx(u,{variant:"outline",size:"icon",className:"h-8 w-8 rounded-full border-border",children:e.jsx(Be,{className:"h-4 w-4"})})}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("h1",{className:"text-xl font-bold",children:["فاتورة #",r]}),e.jsx(E,{variant:"outline",className:`font-bold border text-[10px] ${se[D]||""}`,children:be?C[D]||D:"حالات متعددة"}),$&&e.jsxs(E,{variant:"outline",className:"text-[9px] font-bold border-amber-700 bg-amber-900/10 text-amber-400 gap-1 flex items-center",children:[e.jsx(Ge,{className:"w-2.5 h-2.5"})," مقفل جزئياً"]})]}),e.jsxs("p",{className:"text-xs text-muted-foreground mt-0.5",children:[s.length," منتج · ",ie(new Date(i.createdAt),"yyyy/MM/dd HH:mm")]})]})]}),e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[e.jsxs(Te,{value:"",onValueChange:t=>{t&&w(t)},disabled:S||$||o,children:[e.jsx(Ie,{className:"h-8 text-xs bg-card border-border w-44",title:o?`مرتبط ببيان مفتوح (${x?.manifestNumber})`:void 0,children:e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsx(Le,{className:`w-3 h-3 ${S?"animate-spin":""}`}),e.jsx("span",{children:"تغيير حالة الكل"})]})}),e.jsxs(Qe,{children:[e.jsx(j,{value:"pending",children:"قيد الانتظار"}),e.jsx(j,{value:"in_shipping",children:"قيد الشحن"}),e.jsx(j,{value:"received",children:"استلم ✓"}),e.jsx(j,{value:"delayed",children:"مؤجل"}),e.jsx(j,{value:"returned",children:"مرتجع"})]})]}),e.jsxs(u,{variant:"outline",size:"sm",onClick:pe,className:"h-8 text-xs gap-1 border-border",children:[e.jsx(_e,{className:"w-3 h-3"}),"فاتورة"]}),s.some(t=>t.status==="pending"||t.status==="warehouse_ready"||t.status==="in_shipping"||t.status==="delayed")&&e.jsxs(u,{variant:"outline",size:"sm",onClick:he,className:"h-8 text-xs gap-1 border-green-700 text-green-400 hover:bg-green-500/10 hover:text-green-400",title:"إرسال رسالة واتساب للعميل",children:[e.jsx(Oe,{className:"w-3 h-3"}),"واتساب"]}),e.jsxs(u,{variant:"outline",size:"sm",onClick:()=>!$&&!o&&N(!0),disabled:$||o,title:o?`لا يمكن الحذف — الفاتورة مرتبطة ببيان مفتوح (${x?.manifestNumber})`:void 0,className:"h-8 text-xs gap-1 border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-400 disabled:opacity-40",children:[e.jsx(Me,{className:"w-3 h-3"}),"حذف الكل"]})]})]}),o&&e.jsxs("div",{className:"flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/40 text-xs text-orange-400",children:[e.jsx("span",{className:"text-base shrink-0",children:"⛔"}),e.jsxs("span",{children:["هذه الفاتورة مرتبطة ببيان شحن مفتوح",e.jsxs("span",{className:"font-bold mx-1 text-orange-300",children:["(",x?.manifestNumber,")"]}),"— لا يمكن تعديل حالة الطلبات إلا من داخل البيان في قسم شركات الشحن. يمكن التعديل فقط بعد إغلاق البيان."]})]}),e.jsx(R,{className:"border-border bg-card",children:e.jsxs(U,{className:"px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-muted-foreground mb-0.5",children:"العميل"}),e.jsx("p",{className:"font-bold",children:i.customerName})]}),i.phone&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-muted-foreground mb-0.5 flex items-center gap-1",children:[e.jsx(He,{className:"w-3 h-3"}),"الهاتف"]}),e.jsx("p",{className:"font-bold",children:i.phone})]}),i.city&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-muted-foreground mb-0.5 flex items-center gap-1",children:[e.jsx(re,{className:"w-3 h-3"}),"المحافظة"]}),e.jsx("p",{className:"font-bold",children:i.city})]}),i.address&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-muted-foreground mb-0.5 flex items-center gap-1",children:[e.jsx(re,{className:"w-3 h-3"}),"العنوان"]}),e.jsx("p",{className:"font-bold",children:i.address})]})]})}),e.jsxs(R,{className:"border-border bg-card",children:[e.jsx(Ee,{className:"pb-2 pt-4 px-4",children:e.jsxs(Fe,{className:"text-sm font-bold flex items-center gap-2",children:[e.jsx(Ke,{className:"w-4 h-4 text-primary"}),"المنتجات (",s.length,")"]})}),e.jsxs(U,{className:"px-4 pb-4 space-y-2",children:[s.map((t,a)=>e.jsxs("div",{className:"flex items-center justify-between py-2 border-b border-border/40 last:border-0",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0",children:a+1}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-bold",children:t.product}),e.jsxs("p",{className:"text-[10px] text-muted-foreground",children:[[t.color,t.size].filter(Boolean).join(" · "),t.color||t.size?" · ":"","×",t.quantity]})]})]}),e.jsxs("div",{className:"text-left",children:[e.jsx("p",{className:"text-sm font-bold text-primary",children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(A(t))}),t.status==="partial_received"&&A(t)!==t.totalPrice&&e.jsx("p",{className:"text-[9px] text-muted-foreground line-through",children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(t.totalPrice)}),e.jsx(E,{variant:"outline",className:`text-[8px] font-bold border mt-0.5 ${se[t.status]||""}`,children:C[t.status]||t.status})]})]},t.id)),e.jsx(qe,{className:"my-2"}),e.jsxs("div",{className:"flex items-center justify-between text-sm font-bold",children:[e.jsxs("span",{children:["الإجمالي (",O?`${ge} من ${_}`:`${_}`," قطعة)"]}),e.jsxs("div",{className:"text-left",children:[e.jsx("span",{className:"text-primary text-base",children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(G)}),O&&G!==L&&e.jsx("p",{className:"text-[10px] text-muted-foreground line-through font-normal",children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(L)})]})]}),M>0&&e.jsxs("div",{className:"flex items-center justify-between text-xs text-muted-foreground",children:[e.jsx("span",{children:"تكلفة الشحن"}),e.jsx("span",{children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(M)})]})]})]}),e.jsx(W,{open:!!h,onOpenChange:t=>{t||w(null)},children:e.jsxs(J,{children:[e.jsxs(V,{children:[e.jsx(Y,{children:"تأكيد تغيير الحالة"}),e.jsxs(X,{children:["هتغير حالة ",s.length," طلب إلى «",C[h??""]??h,"». هل أنت متأكد؟"]})]}),e.jsxs(Z,{children:[e.jsx(ee,{children:"إلغاء"}),e.jsx(te,{onClick:()=>h&&ue(h),disabled:S,children:S?"جاري التحديث...":"تأكيد"})]})]})}),e.jsx(W,{open:oe,onOpenChange:N,children:e.jsxs(J,{children:[e.jsxs(V,{children:[e.jsx(Y,{children:"تأكيد حذف الفاتورة"}),e.jsxs(X,{children:["هتحذف ",s.length," طلب في الفاتورة #",r,". هذا الإجراء لا يمكن التراجع عنه."]})]}),e.jsxs(Z,{children:[e.jsx(ee,{children:"إلغاء"}),e.jsx(te,{className:"bg-destructive text-destructive-foreground hover:bg-destructive/90",onClick:xe,disabled:q,children:q?"جاري الحذف...":`حذف ${s.length} طلب`})]})]})}),e.jsx(ze,{open:!!f,onOpenChange:t=>{t||Q(null)},order:f,onSent:()=>f&&fe(f.id,f.status)})]})}export{dt as default};
