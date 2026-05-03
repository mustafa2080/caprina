import{u as O,j as e}from"./vendor-query-Bj6efJQO.js";import{c as je}from"./api-BuEMUGR6.js";import{i as ke,o as I,B as _,s as $e}from"./index-BAubA54f.js";import{r as f}from"./vendor-router-D4U-j562.js";import{C as V}from"./card-C-T2mv30.js";import{B as ze}from"./badge-DFxCJvjz.js";import{S as Y,a as J,b as X,c as Z,d as b}from"./select-D4l21k5r.js";import{a3 as Se,H as ee,a7 as te,F as Pe}from"./vendor-icons-CMIab_CS.js";import{f as se}from"./format-zUbpSLGt.js";import"./vendor-ui-0K0Ol4RT.js";import"./vendor-charts-BJCyhj9w.js";const Ce={pending:"قيد الانتظار",in_shipping:"قيد الشحن",received:"استلم",delayed:"مؤجل",returned:"مرتجع",partial_received:"استلم جزئي"},Ie={pending:"bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",in_shipping:"bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",received:"bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",delayed:"bg-blue-50    dark:bg-blue-900/30    text-blue-700    dark:text-blue-400    border-blue-300    dark:border-blue-800",returned:"bg-red-50     dark:bg-red-900/30     text-red-700     dark:text-red-400     border-red-300     dark:border-red-800",partial_received:"bg-purple-50  dark:bg-purple-900/30  text-purple-700  dark:text-purple-400  border-purple-300  dark:border-purple-800"},w=N=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:2}).format(N);function Be(){const{brand:N}=ke(),c=new URLSearchParams(typeof window<"u"?window.location.search:"").get("invoiceNumber"),[y,S]=f.useState(c?new Set([c]):new Set),[F,re]=f.useState(c?"all":"in_shipping"),[g,ie]=f.useState(4),{data:q,isLoading:P}=je({status:F!=="all"?F:void 0}),{data:E}=O({queryKey:["shipping"],queryFn:$e.list}),{data:u,isLoading:Q}=O({queryKey:["invoice-direct-print",c],queryFn:()=>I.byInvoice(c),enabled:!!c}),{data:M}=O({queryKey:["in-manifest-ids"],queryFn:I.inManifestIds}),D=f.useMemo(()=>{if(!q)return[];const t=M?new Set(M.ids):new Set;return q.filter(s=>s.status==="pending"||s.status==="in_shipping"&&!s.invoiceNumber?.trim()?!1:!(s._groupIds??[s.id]).every(n=>t.has(n)))},[q,M]),h=f.useMemo(()=>{const t=new Map;for(const s of D){const r=s.invoiceNumber??`solo-${s.id}`;if(t.has(r)){const n=t.get(r);n.orders.some(d=>d.id===s.id)||(n.orders=[...n.orders,s])}else{const n=s._invoiceOrders,o=n&&n.length>0?n:[s];t.set(r,{rep:s,orders:o})}}return c&&u?.length&&!t.has(c)&&t.set(c,{rep:u[0],orders:u}),Array.from(t.entries()).map(([s,{rep:r,orders:n}])=>({invoiceNumber:s,representativeId:r.id,orders:n,customerName:r.customerName,totalPrice:n.reduce((o,d)=>o+d.totalPrice,0),status:r.status,createdAt:r.createdAt,phone:r.phone??null,city:r.city??null}))},[D,u,c]),[k,ae]=f.useState(new Map),T=f.useRef(new Set);f.useEffect(()=>{if(!h.length)return;const t=h.filter(s=>s.invoiceNumber&&!s.invoiceNumber.startsWith("solo-")&&!T.current.has(s.invoiceNumber));t.length&&(t.forEach(s=>T.current.add(s.invoiceNumber)),Promise.all(t.map(async s=>{try{const r=await I.byInvoice(s.invoiceNumber);if(r&&r.length>0)return{key:s.invoiceNumber,orders:r}}catch{}return{key:s.invoiceNumber,orders:s.orders}})).then(s=>{ae(r=>{const n=new Map(r);return s.forEach(o=>n.set(o.key,o.orders)),n})}))},[h]);const ne=t=>{S(s=>{const r=new Set(s);return r.has(t)?r.delete(t):r.add(t),r})},oe=t=>y.has(t),de=()=>{S(new Set(h.map(t=>t.invoiceNumber)))},le=()=>S(new Set),L=async(t=y)=>{const s=h.filter(i=>t.has(i.invoiceNumber));if(!s.length){alert("اختر فواتير للطباعة أولاً.");return}const r=new Map;await Promise.all(s.map(async i=>{if(i.invoiceNumber.startsWith("solo-")){r.set(i.invoiceNumber,i.orders);return}try{const m=await I.byInvoice(i.invoiceNumber);if(m&&m.length>0){r.set(i.invoiceNumber,m);return}}catch{}if(k.has(i.invoiceNumber)){const m=k.get(i.invoiceNumber);if(m.length>0){r.set(i.invoiceNumber,m);return}}if(u&&u.length>0&&u[0].invoiceNumber===i.invoiceNumber){r.set(i.invoiceNumber,u);return}r.set(i.invoiceNumber,i.orders)}));let n="";if(N.logoUrl)try{const m=await(await fetch(N.logoUrl)).blob();n=await new Promise(p=>{const x=new FileReader;x.onload=()=>p(x.result),x.readAsDataURL(m)})}catch{}const o=N.name||"CAPRINA",d=N.tagline||"WIN OR DIE",C=[];for(let i=0;i<s.length;i+=g)C.push(s.slice(i,i+g));const j=window.open("","_blank");if(!j)return;const ce=`
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap');
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
        direction: rtl; background: white; color: #111; font-size: 9pt;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .page {
        display: grid;
        ${g===1?"grid-template-columns: 1fr; grid-template-rows: 1fr;":g===2?"grid-template-columns: 1fr 1fr; grid-template-rows: 1fr;":"grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;"}
        gap: 2mm; width: 297mm; height: 210mm; padding: 3mm;
        page-break-after: always;
      }
      .page:last-child { page-break-after: avoid; }

      .inv {
        border: 1.5px solid #1a1a1a; border-radius: 2mm;
        display: flex; flex-direction: column;
        overflow: hidden; background: white;
        min-height: 0; min-width: 0;
      }

      .inv-hdr {
        background: #1a1a1a; color: white;
        display: grid; grid-template-columns: auto 1fr auto;
        align-items: center; padding: 1.5mm 3mm; gap: 2mm; flex-shrink: 0;
      }
      .hdr-date  { font-size: 7pt; opacity: 0.85; white-space: nowrap; direction: ltr; }
      .hdr-mid   { text-align: center; line-height: 1.3; }
      .hdr-brand { font-size: 10pt; font-weight: 900; letter-spacing: 2px; }
      .hdr-order { font-size: 6pt; opacity: 0.6; letter-spacing: 1px; }
      .hdr-logo  { display: flex; align-items: center; gap: 1.5mm; }
      .logo-img  { width: 8mm; height: 8mm; object-fit: contain; border-radius: 1mm; }
      .logo-txt  { font-size: 10pt; font-weight: 900; letter-spacing: 2px; line-height: 1; }
      .logo-sub  { font-size: 4.5pt; opacity: 0.6; letter-spacing: 2px; }

      .cust-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.2mm 3mm; border-bottom: 1px solid #ddd;
        background: #f9f9f9; flex-shrink: 0; gap: 2mm;
      }
      .cust-phone { font-size: 9pt; font-weight: 700; direction: ltr; }
      .cust-name  { font-size: 11pt; font-weight: 900; }

      .inv-body { padding: 1.5mm 3mm; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 1mm; justify-content: space-between; overflow: hidden; }

      .prod-table { width: 100%; border-collapse: collapse; flex-shrink: 1; }
      .prod-table th {
        background: #1a1a1a; color: white; border: 0.5px solid #333;
        padding: 0.8mm 1mm; font-weight: 700; font-size: 7pt; text-align: center;
      }
      .prod-table td {
        border: 0.5px solid #ddd; padding: 0.8mm 1mm;
        text-align: center; font-size: 7pt; vertical-align: middle;
        line-height: 1.2;
      }
      .prod-table td.name-col { text-align: right; font-weight: 700; }
      .prod-table .total-row td {
        background: #f0f0f0; font-weight: 900; font-size: 7pt; border-color: #bbb; color: #111;
      }
      .prod-table .total-row td.t-label { text-align: right; }

      .info-strip {
        display: grid; grid-template-columns: 1fr 1fr 1fr;
        border: 0.5px solid #ddd; border-radius: 1mm;
        overflow: hidden; flex-shrink: 0;
      }
      .info-cell { padding: 0.8mm 1.5mm; border-left: 0.5px solid #ddd; display: flex; flex-direction: column; }
      .info-cell:last-child { border-left: none; }
      .info-lbl { font-size: 5.5pt; color: #999; }
      .info-val { font-size: 7pt; font-weight: 700; min-height: 3mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .addr-box { border: 0.5px solid #ddd; border-radius: 1mm; padding: 0.8mm 1.5mm; flex-shrink: 0; }
      .addr-lbl { font-size: 5.5pt; color: #999; }
      .addr-val { font-size: 7.5pt; font-weight: 700; word-break: break-word; line-height: 1.4; }

      .notes-box {
        background: #fff8e1; border: 0.5px solid #ffe082;
        border-right: 3px solid #f59e0b; border-radius: 1mm;
        padding: 1.2mm 2mm; font-size: 6.5pt; color: #333;
        display: flex; gap: 1.5mm; flex-shrink: 0; line-height: 1.5;
      }
      .notes-box b { color: #b45309; white-space: nowrap; font-size: 7pt; }

      .confirm-box {
        border: 0.8px solid #bbb; border-radius: 1mm;
        padding: 1.2mm 2mm; font-size: 6pt; color: #333; flex-shrink: 0;
        display: flex; gap: 1.5mm; align-items: flex-start; line-height: 1.5;
        background: #fafafa;
      }
      .confirm-box .cb-lbl { font-weight: 900; color: #111; font-size: 6.5pt; white-space: nowrap; }

      .inv-footer {
        border-top: 1.5px solid #1a1a1a; background: #1a1a1a;
        padding: 1.5mm 3mm; flex-shrink: 0;
        display: flex; justify-content: space-between; align-items: center; gap: 2mm;
      }
      .policy-txt   { font-size: 5.5pt; color: #aaa; text-align: left; line-height: 1.5; }
      .footer-brand { font-size: 7pt; font-weight: 900; color: #fff; letter-spacing: 2px; }

      .empty-slot { border: 1px dashed #ddd; border-radius: 2mm; background: #fafafa; }
    `,me=i=>{const m=r.get(i.invoiceNumber)??i.orders,p=m[0],x=E?.find(a=>a.id===p.shippingCompanyId),he=p.trackingNumber??p.tracking_number??"",ue=p.notes??p.note??p.orderNotes??"",R=p.shippingCost??p.shipping_cost??0,fe=se(new Date(i.createdAt),"yyyy/MM/dd"),ge=n?`<img src="${n}" class="logo-img" alt="${o}" />`:"",be=p.address??"",xe=String(p.id).padStart(4,"0"),ve=p.city??"",$=new Map;for(const a of m){const v=a.color??"",K=a.size??"",A=`${a.product}|||${v}|||${K}|||${a.unitPrice}`;if($.has(A)){const z=$.get(A);z.quantity+=a.quantity,z.totalPrice=parseFloat((z.totalPrice+a.totalPrice).toFixed(2)),a.partialQuantity!=null&&(z.partialQuantity=(z.partialQuantity??0)+a.partialQuantity)}else $.set(A,{product:a.product,color:v,size:K,quantity:a.quantity,partialQuantity:a.partialQuantity??null,unitPrice:a.unitPrice,totalPrice:a.totalPrice})}const U=$.size,G=g===4?4:g===2?8:15,H=U<=G?1:Math.max(.6,G/U),W=(7*H).toFixed(1),l=H<.85?"0.4mm 0.8mm":"0.8mm 1mm",ye=Array.from($.values()).map(a=>{const v=a.partialQuantity!=null?`${a.partialQuantity} / ${a.quantity}`:`${a.quantity}`;return`
          <tr>
            <td class="name-col" style="padding:${l}">${a.product}</td>
            <td style="padding:${l}">${a.size||"&#8212;"}</td>
            <td style="padding:${l}">${a.color||"&#8212;"}</td>
            <td style="font-weight:900;padding:${l}">${v}</td>
            <td style="padding:${l}">${w(a.unitPrice)}</td>
            <td style="font-weight:900;padding:${l}">${w(a.totalPrice)}</td>
          </tr>`}).join(""),we=m.reduce((a,v)=>a+v.quantity,0),Ne=m.reduce((a,v)=>a+v.totalPrice,0);return`
        <div class="inv">
          <div class="inv-hdr">
            <div class="hdr-date">${fe}</div>
            <div class="hdr-mid">
              <div class="hdr-brand">${o}</div>
              <div class="hdr-order">ORDER #${xe}</div>
            </div>
            <div class="hdr-logo">
              <div style="text-align:left">
                <div class="logo-txt">${o}</div>
                <div class="logo-sub">${d}</div>
              </div>
              ${ge}
            </div>
          </div>

          <div class="cust-row">
            <div class="cust-phone">&#128222; ${i.phone??"&#8212;"}</div>
            <div class="cust-name">${i.customerName}</div>
          </div>

          <div class="inv-body">
            <table class="prod-table" style="font-size:${W}pt">
              <thead>
                <tr>
                  <th style="width:30%;padding:${l}">الصنف</th>
                  <th style="width:14%;padding:${l}">المقاس</th>
                  <th style="width:18%;padding:${l}">اللون</th>
                  <th style="width:10%;padding:${l}">العدد</th>
                  <th style="width:14%;padding:${l}">السعر</th>
                  <th style="width:14%;padding:${l}">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${ye}
                ${R>0?`<tr>
                  <td class="name-col" colspan="4" style="color:#777;font-size:${(parseFloat(W)*.85).toFixed(1)}pt;padding:${l}">مصاريف الشحن</td>
                  <td colspan="2" style="font-weight:700;padding:${l}">${w(R)}</td>
                </tr>`:""}
                <tr class="total-row">
                  <td class="t-label" colspan="3" style="padding:${l}">&#9679; الإجمالي الكلي</td>
                  <td style="font-weight:900;padding:${l}">${we}</td>
                  <td colspan="2" style="font-weight:900;padding:${l}">${w(Ne+R)}</td>
                </tr>
              </tbody>
            </table>

            <div class="info-strip">
              <div class="info-cell">
                <span class="info-lbl">المحافظة</span>
                <span class="info-val">${ve||"&#8212;"}</span>
              </div>
              <div class="info-cell">
                <span class="info-lbl">شركة الشحن</span>
                <span class="info-val">${x?x.name:"&#8212;"}</span>
              </div>
              <div class="info-cell">
                <span class="info-lbl">رقم التتبع</span>
                <span class="info-val" style="direction:ltr;text-align:right">${he||"&#8212;"}</span>
              </div>
            </div>

            <div class="addr-box">
              <div class="addr-lbl">العنوان بالتفصيل</div>
              <div class="addr-val">${be||"&#8212;"}</div>
            </div>

            <div class="notes-box">
              <b>&#128203; ملاحظات:</b>
              <span>${ue||"&#8212;"}</span>
            </div>

            <div class="confirm-box">
              <span class="cb-lbl">&#10003; التاكيد علي الشحن:</span>
              <span>تم التاكيد مع العميل &#8212; في حاله عدم الاستلام بيتم دفع مصاريف الشحن كامله المتفق عليها</span>
            </div>
          </div>

          <div class="inv-footer">
            <div class="policy-txt">الاسترجاع فقط اثناء تواجد المندوب &middot; الاستبدال خلال 7 أيام &middot; ضمان 6 أشهر &middot; احتفظ بالفاتورة</div>
            <div class="footer-brand">${o}</div>
          </div>
        </div>
      `},pe=C.map(i=>{const m=i.map(x=>me(x)).join(""),p=i.length<g?Array(g-i.length).fill('<div class="empty-slot"></div>').join(""):"";return`<div class="page">${m}${p}</div>`}).join("");j.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فواتير ${o}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <style>${ce}</style>
</head>
<body>${pe}</body>
</html>`),j.document.close(),j.onload=()=>{setTimeout(()=>{j.focus(),j.print()},600)}},B=f.useRef(!1);return f.useEffect(()=>{if(!c||B.current||P||Q||!h.length||!h.some(d=>d.invoiceNumber===c))return;const t=h.find(d=>d.invoiceNumber===c),s=k.has(c),r=u&&u.length>0;if(!(s||r||t&&t.orders.length>1))return;const o=new Set([c]);S(o),B.current=!0,L(o)},[c,P,Q,h,k,u]),e.jsxs("div",{className:"space-y-5 animate-in fade-in duration-500",dir:"rtl",children:[e.jsxs("div",{className:"flex items-center justify-between flex-wrap gap-3",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-bold",children:"الفواتير"}),e.jsx("p",{className:"text-muted-foreground text-sm mt-0.5",children:"تظهر فقط الطلبات قيد الشحن أو ما بعدها — الطلبات قيد الانتظار لا تظهر هنا"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"text-xs text-muted-foreground whitespace-nowrap",children:"فواتير في الصفحة:"}),e.jsxs(Y,{value:String(g),onValueChange:t=>ie(Number(t)),children:[e.jsx(J,{className:"w-24 h-9 text-sm bg-card border-border",children:e.jsx(X,{})}),e.jsxs(Z,{children:[e.jsx(b,{value:"1",children:"1 فاتورة"}),e.jsx(b,{value:"2",children:"2 فواتير"}),e.jsx(b,{value:"4",children:"4 فواتير"})]})]})]}),e.jsxs(_,{onClick:()=>{L()},className:"gap-2 font-bold text-sm",disabled:y.size===0,children:[e.jsx(Se,{className:"w-4 h-4"}),"طباعة (",y.size,")"]})]}),e.jsxs("div",{className:"flex items-center gap-3 flex-wrap",children:[e.jsxs(Y,{value:F,onValueChange:t=>re(t),children:[e.jsx(J,{className:"w-44 h-9 text-sm bg-card border-border",children:e.jsx(X,{placeholder:"تصفية بالحالة"})}),e.jsxs(Z,{children:[e.jsx(b,{value:"all",children:"كل الحالات"}),e.jsx(b,{value:"in_shipping",children:"قيد الشحن"}),e.jsx(b,{value:"received",children:"استلم"}),e.jsx(b,{value:"delayed",children:"مؤجل"}),e.jsx(b,{value:"returned",children:"مرتجع"}),e.jsx(b,{value:"partial_received",children:"استلم جزئي"})]})]}),e.jsxs(_,{variant:"outline",size:"sm",className:"h-9 text-xs gap-1 border-border",onClick:de,children:[e.jsx(ee,{className:"w-3.5 h-3.5"}),"تحديد الكل"]}),y.size>0&&e.jsxs(_,{variant:"ghost",size:"sm",className:"h-9 text-xs gap-1",onClick:le,children:[e.jsx(te,{className:"w-3.5 h-3.5"}),"إلغاء التحديد"]}),y.size>0&&e.jsxs("span",{className:"text-xs text-primary font-bold",children:[y.size," محدد للطباعة"]}),!P&&e.jsxs("span",{className:"text-xs text-muted-foreground mr-auto",children:[h.length," فاتورة"]})]}),P?e.jsx("div",{className:"p-8 text-center text-muted-foreground text-sm",children:"جاري التحميل..."}):h.length?e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3",children:h.map(t=>{const s=oe(t.invoiceNumber),r=E?.find(d=>d.id===t.orders[0].shippingCompanyId),n=k.get(t.invoiceNumber)??t.orders,o=n.length>1;return e.jsxs(V,{onClick:()=>ne(t.invoiceNumber),className:`border p-4 cursor-pointer transition-all select-none ${s?"border-primary bg-primary/5 shadow-sm":"border-border bg-card hover:border-primary/40 hover:bg-muted/10"}`,children:[e.jsxs("div",{className:"flex items-start justify-between gap-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[s?e.jsx(ee,{className:"w-4 h-4 text-primary shrink-0"}):e.jsx(te,{className:"w-4 h-4 text-muted-foreground shrink-0"}),e.jsxs("div",{children:[e.jsx("p",{className:"font-bold text-sm leading-tight",children:t.customerName}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsxs("p",{className:"text-[10px] text-muted-foreground font-mono",children:["#",t.representativeId.toString().padStart(4,"0")]}),o&&e.jsxs("span",{className:"text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full",children:[n.length," منتجات"]})]})]})]}),e.jsx(ze,{variant:"outline",className:`text-[9px] font-bold border shrink-0 ${Ie[t.status]||""}`,children:Ce[t.status]})]}),e.jsxs("div",{className:"mt-3 space-y-1 text-xs text-muted-foreground",children:[o?e.jsxs("div",{className:"space-y-0.5",children:[n.map(d=>e.jsxs("div",{className:"flex justify-between",children:[e.jsxs("span",{className:"font-medium text-foreground truncate",children:[d.product," ×",d.quantity]}),e.jsx("span",{className:"font-bold text-primary shrink-0 mr-1",children:w(d.totalPrice)})]},d.id)),e.jsxs("div",{className:"flex justify-between border-t border-border pt-1 mt-1",children:[e.jsx("span",{className:"font-bold text-foreground",children:"الإجمالي"}),e.jsx("span",{className:"font-bold text-primary",children:w(n.reduce((d,C)=>d+C.totalPrice,0))})]})]}):e.jsxs("div",{className:"flex justify-between",children:[e.jsxs("span",{className:"font-medium text-foreground",children:[n[0].product," ×",n[0].quantity]}),e.jsx("span",{className:"font-bold text-primary",children:w(n[0].totalPrice)})]}),e.jsx("div",{className:"flex gap-3",children:r&&e.jsxs("span",{children:["🚚 ",r.name]})}),t.phone&&e.jsxs("p",{className:"font-mono text-[11px]",children:["📞 ",t.phone]}),t.city&&e.jsxs("p",{children:["📍 ",t.city]}),e.jsx("p",{className:"text-[10px] opacity-60",children:se(new Date(t.createdAt),"yyyy/MM/dd")})]})]},t.invoiceNumber)})}):e.jsxs(V,{className:"border-border p-12 text-center",children:[e.jsx(Pe,{className:"w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20"}),e.jsx("p",{className:"font-bold",children:"لا توجد طلبات"}),e.jsx("p",{className:"text-sm text-muted-foreground mt-1",children:"سيظهر هنا الطلبات بعد إنشائها"})]})]})}export{Be as default};
