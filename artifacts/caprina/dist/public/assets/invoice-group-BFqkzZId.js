import{b as fe,u as be,j as e}from"./vendor-query-Bj6efJQO.js";import{h as je,u as ye,r as g,L as A}from"./vendor-router-D4U-j562.js";import{i as ve,d as Ne,u as we,B as o,a as Ce}from"./index-CIRou9kO.js";import{b as Se,g as O,d as Pe}from"./api-BCk-rqJ9.js";import{B as D}from"./badge-Dt_MIZZx.js";import{C as R,c as U,a as $e,b as Ae}from"./card-Bzjhlc4y.js";import{S as De}from"./separator-DPgCzD0s.js";import{S as ke,a as Ee,c as Fe,d as f}from"./select-CoC73HT0.js";import{A as H,a as K,b as M,c as W,d as V,e as Y,f as J,g as X}from"./alert-dialog-BSo388zv.js";import{S as N,a as Z,W as Te}from"./whatsapp-dialog-IyWzhJQv.js";import{s as ee,V as qe,L as ze,R as Be,a3 as Ge,f as Ie,G as Qe,Y as Le,_ as te,P as _e}from"./vendor-icons-CMIab_CS.js";import{f as se}from"./format-zUbpSLGt.js";import"./vendor-ui-0K0Ol4RT.js";import"./vendor-charts-BJCyhj9w.js";import"./textarea-yP34lk3s.js";import"./whatsapp-CkJIob2L.js";const b=w=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(w);function rt(){const{brand:w}=ve(),ae=je(),n=decodeURIComponent(ae.invoiceNumber??""),[,re]=ye(),j=fe(),{toast:m}=Ne(),{isAdmin:ie}=we(),k=Se(),[ne,C]=g.useState(!1),[E,F]=g.useState(!1),[x,S]=g.useState(null),[y,T]=g.useState(!1),[u,q]=g.useState(null),{data:s,isLoading:le,error:z}=be({queryKey:["invoice-group",n],queryFn:()=>Ce(`/orders/by-invoice/${encodeURIComponent(n)}`),enabled:!!n,staleTime:0,retry:3,retryDelay:1e3}),B=()=>{j.invalidateQueries({queryKey:O()}),j.invalidateQueries({queryKey:Pe()}),j.invalidateQueries({queryKey:["invoice-group",n]})},de=async t=>{if(!s?.length)return;T(!0);let a=0;for(const r of s)try{await new Promise((d,p)=>{k.mutate({id:r.id,data:{status:t}},{onSuccess:()=>d(),onError:()=>p()})}),a++}catch{}B(),S(null),T(!1),m({title:`تم تحديث ${a} طلب ✅`,description:`الحالة: ${N[t]??t}`})},oe=async()=>{if(s?.length){F(!0);try{const t=localStorage.getItem("caprina_token"),a=s.map(p=>p.id),d=await(await fetch("/api/orders/bulk",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({ids:a})})).json();await j.refetchQueries({queryKey:O()}),m({title:`تم حذف ${d.deleted} طلب ✅`}),re("/orders")}catch{m({title:"خطأ",description:"فشل الحذف",variant:"destructive"})}finally{F(!1),C(!1)}}},ce=()=>{if(!s?.length)return;const t=s[0],a=s.reduce((l,h)=>l+h.quantity,0),r=s.reduce((l,h)=>l+h.totalPrice,0),d=t.shippingCost??0,p=w.name||"CAPRINA",he=se(new Date(t.createdAt),"yyyy/MM/dd HH:mm"),ge=s.map((l,h)=>`
      <tr>
        <td>${h+1}</td>
        <td class="name">${l.product}</td>
        <td>${[l.color,l.size].filter(Boolean).join(" / ")||"-"}</td>
        <td>${l.quantity}</td>
        <td>${b(l.unitPrice)}</td>
        <td>${b(l.totalPrice)}</td>
      </tr>
    `).join(""),c=window.open("","_blank");c&&(c.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>فاتورة ${n}</title>
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
        <div class="brand">${p}</div>
        <div class="muted">فاتورة رقم: ${n}</div>
        <div class="muted">${he}</div>
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
        ${ge}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>إجمالي المنتجات</span><b>${b(r)}</b></div>
      <div class="totals-row"><span>الشحن</span><b>${b(d)}</b></div>
      <div class="totals-row total"><span>الإجمالي الكلي</span><b>${b(r+d)}</b></div>
    </div>
  </div>
</body>
</html>`),c.document.close(),c.onload=()=>{setTimeout(()=>{c.focus(),c.print()},400)})},me=()=>{if(!s?.length)return;const t=s[0];q({id:t.id,customerName:t.customerName,product:s.map(a=>`${a.product}×${a.quantity}`).join("، "),quantity:s.reduce((a,r)=>a+r.quantity,0),totalPrice:s.reduce((a,r)=>a+r.totalPrice,0),status:t.status,phone:t.phone})},xe=async(t,a)=>{if(s?.length)if(a==="pending"){for(const r of s)r.status==="pending"&&await new Promise(d=>{k.mutate({id:r.id,data:{status:"in_shipping"}},{onSuccess:()=>d(),onError:()=>d()})});B(),m({title:"تم إرسال واتساب ✅",description:"تم تحويل الطلبات لـ «قيد الشحن»"})}else m({title:"تم فتح واتساب ✅",description:"الرسالة جاهزة للإرسال"})};if(le)return e.jsx("div",{className:"p-12 text-center text-muted-foreground animate-pulse",children:"جاري التحميل..."});if(z)return e.jsxs("div",{className:"p-12 text-center",children:[e.jsx(ee,{className:"w-12 h-12 mx-auto mb-3 text-destructive opacity-50"}),e.jsx("h2",{className:"text-lg font-bold mb-2",children:"حدث خطأ في تحميل الفاتورة"}),e.jsx("p",{className:"text-sm text-muted-foreground mb-3",children:z?.message||"تعذر الاتصال بالسيرفر"}),e.jsxs("p",{className:"text-xs text-muted-foreground mb-4 font-mono bg-muted/20 p-2 rounded",children:["رقم الفاتورة: ",n||"(فارغ)"]}),e.jsxs("div",{className:"flex gap-2 justify-center",children:[e.jsx(o,{variant:"outline",onClick:()=>window.location.reload(),children:"إعادة المحاولة"}),e.jsx(A,{href:"/orders",children:e.jsx(o,{variant:"outline",children:"العودة للطلبات"})})]})]});if(!s?.length)return e.jsxs("div",{className:"p-12 text-center",children:[e.jsx(ee,{className:"w-12 h-12 mx-auto mb-3 text-destructive opacity-50"}),e.jsx("h2",{className:"text-lg font-bold mb-2",children:"الفاتورة غير موجودة"}),e.jsxs("p",{className:"text-sm text-muted-foreground mb-3",children:["رقم الفاتورة: ",n]}),e.jsx(A,{href:"/orders",children:e.jsx(o,{variant:"outline",className:"mt-3",children:"العودة للطلبات"})})]});const i=s[0],P=t=>t.status==="partial_received"&&t.partialQuantity!=null&&t.unitPrice!=null?Math.round(t.unitPrice*t.partialQuantity):t.totalPrice,G=s.reduce((t,a)=>t+P(a),0),I=s.reduce((t,a)=>t+a.totalPrice,0),Q=s.reduce((t,a)=>t+a.quantity,0),ue=s.reduce((t,a)=>t+(a.status==="partial_received"&&a.partialQuantity!=null?a.partialQuantity:a.quantity),0),L=s.some(t=>t.status==="partial_received"),_=i.shippingCost??0,pe=s.every(t=>t.status===i.status),$=i.status,v=s.some(t=>t.status==="received"||t.status==="partial_received")&&!ie;return e.jsxs("div",{className:"max-w-4xl mx-auto space-y-5 animate-in fade-in duration-500",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(A,{href:"/orders",children:e.jsx(o,{variant:"outline",size:"icon",className:"h-8 w-8 rounded-full border-border",children:e.jsx(qe,{className:"h-4 w-4"})})}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("h1",{className:"text-xl font-bold",children:["فاتورة #",n]}),e.jsx(D,{variant:"outline",className:`font-bold border text-[10px] ${Z[$]||""}`,children:pe?N[$]||$:"حالات متعددة"}),v&&e.jsxs(D,{variant:"outline",className:"text-[9px] font-bold border-amber-700 bg-amber-900/10 text-amber-400 gap-1 flex items-center",children:[e.jsx(ze,{className:"w-2.5 h-2.5"})," مقفل جزئياً"]})]}),e.jsxs("p",{className:"text-xs text-muted-foreground mt-0.5",children:[s.length," منتج · ",se(new Date(i.createdAt),"yyyy/MM/dd HH:mm")]})]})]}),e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[e.jsxs(ke,{value:"",onValueChange:t=>{t&&S(t)},disabled:y||v,children:[e.jsx(Ee,{className:"h-8 text-xs bg-card border-border w-44",children:e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsx(Be,{className:`w-3 h-3 ${y?"animate-spin":""}`}),e.jsx("span",{children:"تغيير حالة الكل"})]})}),e.jsxs(Fe,{children:[e.jsx(f,{value:"pending",children:"قيد الانتظار"}),e.jsx(f,{value:"in_shipping",children:"قيد الشحن"}),e.jsx(f,{value:"received",children:"استلم ✓"}),e.jsx(f,{value:"delayed",children:"مؤجل"}),e.jsx(f,{value:"returned",children:"مرتجع"})]})]}),e.jsxs(o,{variant:"outline",size:"sm",onClick:ce,className:"h-8 text-xs gap-1 border-border",children:[e.jsx(Ge,{className:"w-3 h-3"}),"فاتورة"]}),s.some(t=>t.status==="pending"||t.status==="in_shipping"||t.status==="delayed")&&e.jsxs(o,{variant:"outline",size:"sm",onClick:me,className:"h-8 text-xs gap-1 border-green-700 text-green-400 hover:bg-green-500/10 hover:text-green-400",title:"إرسال رسالة واتساب للعميل",children:[e.jsx(Ie,{className:"w-3 h-3"}),"واتساب"]}),e.jsxs(o,{variant:"outline",size:"sm",onClick:()=>!v&&C(!0),disabled:v,className:"h-8 text-xs gap-1 border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-400 disabled:opacity-40",children:[e.jsx(Qe,{className:"w-3 h-3"}),"حذف الكل"]})]})]}),e.jsx(R,{className:"border-border bg-card",children:e.jsxs(U,{className:"px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-muted-foreground mb-0.5",children:"العميل"}),e.jsx("p",{className:"font-bold",children:i.customerName})]}),i.phone&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-muted-foreground mb-0.5 flex items-center gap-1",children:[e.jsx(Le,{className:"w-3 h-3"}),"الهاتف"]}),e.jsx("p",{className:"font-bold",children:i.phone})]}),i.city&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-muted-foreground mb-0.5 flex items-center gap-1",children:[e.jsx(te,{className:"w-3 h-3"}),"المحافظة"]}),e.jsx("p",{className:"font-bold",children:i.city})]}),i.address&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-muted-foreground mb-0.5 flex items-center gap-1",children:[e.jsx(te,{className:"w-3 h-3"}),"العنوان"]}),e.jsx("p",{className:"font-bold",children:i.address})]})]})}),e.jsxs(R,{className:"border-border bg-card",children:[e.jsx($e,{className:"pb-2 pt-4 px-4",children:e.jsxs(Ae,{className:"text-sm font-bold flex items-center gap-2",children:[e.jsx(_e,{className:"w-4 h-4 text-primary"}),"المنتجات (",s.length,")"]})}),e.jsxs(U,{className:"px-4 pb-4 space-y-2",children:[s.map((t,a)=>e.jsxs("div",{className:"flex items-center justify-between py-2 border-b border-border/40 last:border-0",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0",children:a+1}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-bold",children:t.product}),e.jsxs("p",{className:"text-[10px] text-muted-foreground",children:[[t.color,t.size].filter(Boolean).join(" · "),t.color||t.size?" · ":"","×",t.quantity]})]})]}),e.jsxs("div",{className:"text-left",children:[e.jsx("p",{className:"text-sm font-bold text-primary",children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(P(t))}),t.status==="partial_received"&&P(t)!==t.totalPrice&&e.jsx("p",{className:"text-[9px] text-muted-foreground line-through",children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(t.totalPrice)}),e.jsx(D,{variant:"outline",className:`text-[8px] font-bold border mt-0.5 ${Z[t.status]||""}`,children:N[t.status]||t.status})]})]},t.id)),e.jsx(De,{className:"my-2"}),e.jsxs("div",{className:"flex items-center justify-between text-sm font-bold",children:[e.jsxs("span",{children:["الإجمالي (",L?`${ue} من ${Q}`:`${Q}`," قطعة)"]}),e.jsxs("div",{className:"text-left",children:[e.jsx("span",{className:"text-primary text-base",children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(G)}),L&&G!==I&&e.jsx("p",{className:"text-[10px] text-muted-foreground line-through font-normal",children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(I)})]})]}),_>0&&e.jsxs("div",{className:"flex items-center justify-between text-xs text-muted-foreground",children:[e.jsx("span",{children:"تكلفة الشحن"}),e.jsx("span",{children:new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(_)})]})]})]}),e.jsx(H,{open:!!x,onOpenChange:t=>{t||S(null)},children:e.jsxs(K,{children:[e.jsxs(M,{children:[e.jsx(W,{children:"تأكيد تغيير الحالة"}),e.jsxs(V,{children:["هتغير حالة ",s.length," طلب إلى «",N[x??""]??x,"». هل أنت متأكد؟"]})]}),e.jsxs(Y,{children:[e.jsx(J,{children:"إلغاء"}),e.jsx(X,{onClick:()=>x&&de(x),disabled:y,children:y?"جاري التحديث...":"تأكيد"})]})]})}),e.jsx(H,{open:ne,onOpenChange:C,children:e.jsxs(K,{children:[e.jsxs(M,{children:[e.jsx(W,{children:"تأكيد حذف الفاتورة"}),e.jsxs(V,{children:["هتحذف ",s.length," طلب في الفاتورة #",n,". هذا الإجراء لا يمكن التراجع عنه."]})]}),e.jsxs(Y,{children:[e.jsx(J,{children:"إلغاء"}),e.jsx(X,{className:"bg-destructive text-destructive-foreground hover:bg-destructive/90",onClick:oe,disabled:E,children:E?"جاري الحذف...":`حذف ${s.length} طلب`})]})]})}),e.jsx(Te,{open:!!u,onOpenChange:t=>{t||q(null)},order:u,onSent:()=>u&&xe(u.id,u.status)})]})}export{rt as default};
