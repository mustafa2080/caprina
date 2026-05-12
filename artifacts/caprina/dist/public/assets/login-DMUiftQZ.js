import{j as e}from"./vendor-query-Bj6efJQO.js";import{u as j,r as a}from"./vendor-router-D4U-j562.js";import{u as k,d as z,E as N}from"./index-Bp-aEjUM.js";import{aP as g,aV as C,aW as c,X as F,aX as p,aY as Y,at as S,al as A}from"./vendor-icons-DZISZaA4.js";import"./vendor-ui-CKS7PsNe.js";import"./vendor-charts-DC233_Rb.js";function O(){const{login:m}=k(),[,b]=j(),{toast:x}=z(),[t,h]=a.useState(""),[i,f]=a.useState(""),[s,u]=a.useState(!1),[l,d]=a.useState(!1),[w,o]=a.useState(!1),v=async r=>{if(r.preventDefault(),!(!t.trim()||!i)){d(!0);try{const{token:n,user:y}=await N.login(t.trim(),i);m(n,y),b("/")}catch(n){x({title:"خطأ في تسجيل الدخول",description:n.message,variant:"destructive"})}finally{d(!1)}}};return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
        :root {
          --gold:       #C9A84C;
          --gold-light: #E8C96A;
          --gold-dim:   #8B6914;
          --gold-pale:  #F0E0A8;
          --black:      #090807;
          --black-card: #1A1714;
          --white:      #FFFFFF;
          --white-off:  #F5F0E8;
          --border:     rgba(201,168,76,0.28);
        }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(30px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes floatY  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes logoGlow{ 0%,100%{box-shadow:0 0 24px rgba(201,168,76,0.35),0 8px 40px rgba(0,0,0,0.7)} 50%{box-shadow:0 0 48px rgba(201,168,76,0.6),0 8px 40px rgba(0,0,0,0.7)} }
        @keyframes scanline{ 0%{top:-2px} 100%{top:100%} }
        @keyframes bglow  { 0%,100%{opacity:0.4} 50%{opacity:1} }
        .fu1{animation:fadeUp .6s .05s both} .fu2{animation:fadeUp .6s .18s both}
        .fu3{animation:fadeUp .6s .30s both} .fu4{animation:fadeUp .6s .42s both}
        .fu5{animation:fadeUp .6s .54s both}

        .lp { position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:flex-start;padding:0 8vw;direction:rtl; }
        .hc {
          max-width:500px;width:100%;
          display:flex;flex-direction:column;align-items:flex-start;
          background:linear-gradient(145deg,rgba(9,8,7,0.45) 0%,rgba(18,14,5,0.4) 100%);
          backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
          border:1px solid rgba(201,168,76,0.18);
          border-radius:1.4rem;
          padding:2.5rem 2.8rem;
          box-shadow:0 24px 80px rgba(0,0,0,0.75),0 0 0 1px rgba(201,168,76,0.06),inset 0 1px 0 rgba(201,168,76,0.1);
          position:relative;overflow:hidden;
        }
        .hc::before {
          content:'';position:absolute;top:0;left:15%;right:15%;height:1px;
          background:linear-gradient(90deg,transparent,var(--gold),rgba(201,168,76,0.5),var(--gold),transparent);
        }

        .logo-wrap { display:flex;align-items:center;gap:1.1rem;margin-bottom:2.2rem;animation:floatY 5s ease-in-out infinite; }
        .logo-ring {
          width:88px;height:88px;border-radius:50%;
          background:linear-gradient(145deg,#1e1a14,#0d0b08);
          border:2px solid var(--gold);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 0 6px rgba(201,168,76,0.08),0 0 32px rgba(201,168,76,0.3),0 8px 32px rgba(0,0,0,0.7);
          animation:logoGlow 3s ease-in-out infinite;
          flex-shrink:0;position:relative;overflow:hidden;
        }
        .logo-ring::before { content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 30%, rgba(201,168,76,0.15) 0%, transparent 65%); }
        .logo-ring img { width:64px;height:64px;border-radius:50%;object-fit:cover;position:relative;z-index:1; }
        .logo-text-block { display:flex;flex-direction:column;gap:2px; }
        .logo-brand {
          font-size:1.9rem;font-weight:900;letter-spacing:0.18em;
          background:linear-gradient(135deg,var(--gold-pale) 0%,var(--gold) 45%,var(--gold-dim) 100%);
          background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
          animation:shimmer 4s linear infinite;line-height:1;
        }
        .logo-sub { font-size:0.65rem;font-weight:600;letter-spacing:0.35em;color:rgba(201,168,76,0.55);text-transform:uppercase; }

        .gold-divider { width:100%;height:1px;background:linear-gradient(90deg,var(--gold) 0%,rgba(201,168,76,0.1) 100%);margin-bottom:2rem;animation:bglow 3s ease-in-out infinite; }

        .h-title { font-size:clamp(1.9rem,4.5vw,3.2rem);font-weight:900;line-height:1.15;color:var(--white);margin-bottom:.6rem;text-shadow:0 2px 4px rgba(0,0,0,1),0 4px 20px rgba(0,0,0,0.9);letter-spacing:-.01em; }
        .h-title .g {
          background:linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,var(--gold-dim) 100%);
          background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite;
        }
        .h-desc { font-size:1rem;font-weight:500;color:rgba(255,255,255,0.75);line-height:1.8;margin-bottom:.5rem;max-width:400px;text-shadow:0 1px 6px rgba(0,0,0,0.9); }

        .tagline {
          font-size:.78rem;font-weight:700;letter-spacing:.4em;color:var(--gold-dim);text-transform:uppercase;
          margin-bottom:2.2rem;display:flex;align-items:center;gap:.7rem;
        }
        .tagline::before,.tagline::after { content:'';flex:1;max-width:40px;height:1px;background:linear-gradient(90deg,var(--gold-dim),transparent); }
        .tagline::after { background:linear-gradient(270deg,var(--gold-dim),transparent); }

        .btn-row { display:flex;flex-direction:row;gap:.9rem;flex-wrap:wrap;margin-bottom:2.5rem; }
        .btn-primary {
          display:inline-flex;align-items:center;gap:.6rem;padding:.85rem 2rem;
          background:linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,var(--gold-dim) 100%);
          color:var(--black);font-size:.88rem;font-weight:800;border:none;border-radius:.6rem;cursor:pointer;
          letter-spacing:.04em;box-shadow:0 4px 0 var(--gold-dim),0 8px 28px rgba(201,168,76,0.35);
          transition:all .2s ease;position:relative;overflow:hidden;text-decoration:none;
        }
        .btn-primary::after { content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 60%);border-radius:.6rem;pointer-events:none; }
        .btn-primary:hover { transform:translateY(-2px);box-shadow:0 6px 0 var(--gold-dim),0 12px 36px rgba(201,168,76,0.5);background:linear-gradient(135deg,#f0e0a8 0%,var(--gold-light) 50%,var(--gold) 100%); }
        .btn-primary:active { transform:translateY(2px);box-shadow:0 2px 0 var(--gold-dim); }
        .btn-ghost {
          display:inline-flex;align-items:center;gap:.6rem;padding:.85rem 2rem;
          background:transparent;color:var(--white-off);font-size:.88rem;font-weight:700;
          border:1.5px solid var(--border);border-radius:.6rem;cursor:pointer;letter-spacing:.04em;
          transition:all .2s ease;text-decoration:none;
        }
        .btn-ghost:hover { background:rgba(201,168,76,0.08);border-color:rgba(201,168,76,0.6);color:var(--gold-light);transform:translateY(-2px);box-shadow:0 0 24px rgba(201,168,76,0.2); }

        .copy-bar { display:flex;align-items:center;gap:.8rem;width:100%; }
        .copy-line { flex:1;height:1px;background:linear-gradient(90deg,rgba(201,168,76,0.35),transparent); }
        .copy-line.r { background:linear-gradient(270deg,rgba(201,168,76,0.35),transparent); }
        .copy-text { font-size:.72rem;font-weight:900;letter-spacing:.2em;color:rgba(201,168,76,0.6);white-space:nowrap;text-transform:uppercase; }

        .ov { position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:rgba(6,5,4,0.82);backdrop-filter:blur(16px);animation:fadeIn .2s ease; }
        .card {
          background:var(--black-card);border:1px solid var(--border);border-radius:1.2rem;
          padding:2.2rem 2rem;width:100%;max-width:380px;direction:rtl;position:relative;overflow:hidden;
          box-shadow:0 32px 80px rgba(0,0,0,0.9),0 0 48px rgba(201,168,76,0.06);
          animation:slideUp .35s cubic-bezier(.22,1,.36,1);
        }
        .card::before { content:'';position:absolute;left:0;right:0;height:1.5px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.5),transparent);animation:scanline 5s linear infinite;pointer-events:none; }
        .card-top-line { position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),rgba(201,168,76,0.6),var(--gold),transparent); }
        .card-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:1.8rem;padding-bottom:1.2rem;border-bottom:1px solid rgba(201,168,76,0.12); }
        .card-head-left { display:flex;align-items:center;gap:.75rem;flex-direction:row-reverse; }
        .card-icon { width:40px;height:40px;border-radius:.65rem;background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(139,105,20,0.08));border:1px solid rgba(201,168,76,0.3);display:flex;align-items:center;justify-content:center;color:var(--gold);flex-shrink:0; }
        .card-title { font-size:1.15rem;font-weight:900;color:var(--white); }
        .card-sub { font-size:.7rem;color:rgba(255,255,255,0.35);margin-top:.15rem; }
        .btn-x { width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.35);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0; }
        .btn-x:hover { background:rgba(255,255,255,0.1);color:var(--white);transform:rotate(90deg);border-color:rgba(255,255,255,0.25); }

        .f-label { font-size:.72rem;font-weight:700;color:rgba(201,168,76,0.8);display:flex;align-items:center;gap:.4rem;margin-bottom:.4rem;letter-spacing:.05em; }
        .f-wrap { position:relative;margin-bottom:1rem; }
        .f-ico-r { position:absolute;right:.85rem;top:50%;transform:translateY(-50%);color:rgba(201,168,76,0.4);pointer-events:none; }
        .f-ico-l { position:absolute;left:.85rem;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;padding:0;display:flex;align-items:center;transition:color .15s; }
        .f-ico-l:hover { color:var(--gold); }
        .f-input { width:100%;height:46px;padding:0 2.6rem;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:.6rem;color:var(--white);font-size:.88rem;outline:none;transition:border-color .2s,box-shadow .2s; }
        .f-input::placeholder { color:rgba(255,255,255,0.18); }
        .f-input:focus { border-color:rgba(201,168,76,0.5);box-shadow:0 0 0 3px rgba(201,168,76,0.08),0 0 12px rgba(201,168,76,0.1);background:rgba(201,168,76,0.04); }
        .btn-sub {
          width:100%;height:48px;margin-top:.5rem;
          background:linear-gradient(135deg,var(--gold-light),var(--gold),var(--gold-dim));
          color:var(--black);font-size:.92rem;font-weight:800;border:none;border-radius:.6rem;cursor:pointer;
          letter-spacing:.06em;box-shadow:0 4px 0 var(--gold-dim),0 8px 24px rgba(201,168,76,0.3);
          display:flex;align-items:center;justify-content:center;gap:.5rem;transition:all .2s;position:relative;overflow:hidden;
        }
        .btn-sub::after { content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%);border-radius:.6rem;pointer-events:none; }
        .btn-sub:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 6px 0 var(--gold-dim),0 12px 32px rgba(201,168,76,0.45); }
        .btn-sub:active:not(:disabled) { transform:translateY(2px);box-shadow:0 1px 0 var(--gold-dim); }
        .btn-sub:disabled { opacity:.3;cursor:not-allowed; }

        @media(max-width:1024px){
          .lp{padding:0 5vw;}
          .hc{max-width:460px;}
        }
        @media(max-width:768px){
          .lp{justify-content:center;padding:1.5rem 1.2rem;align-items:center;}
          .hc{align-items:center;text-align:center;padding:2rem 1.8rem;max-width:100%;}
          .h-title{font-size:2rem;text-align:center;}
          .h-desc{text-align:center;font-size:.92rem;}
          .btn-row{justify-content:center;width:100%;}
          .copy-bar{justify-content:center;}
          .gold-divider{display:none;}
          .logo-wrap{margin-bottom:1.6rem;}
          .tagline{margin-bottom:1.6rem;}
        }
        @media(max-width:480px){
          .lp{padding:1rem .9rem;align-items:flex-start;padding-top:2rem;}
          .hc{padding:1.6rem 1.3rem;}
          .h-title{font-size:1.65rem;}
          .h-desc{font-size:.85rem;}
          .btn-primary,.btn-ghost{width:100%;justify-content:center;padding:.8rem 1.2rem;}
          .btn-row{flex-direction:column;gap:.65rem;width:100%;}
          .logo-ring{width:68px;height:68px;}
          .logo-ring img{width:50px;height:50px;}
          .logo-brand{font-size:1.4rem;}
          .logo-wrap{gap:.8rem;margin-bottom:1.4rem;}
          .tagline{font-size:.7rem;margin-bottom:1.4rem;}
          .copy-bar{gap:.5rem;}
          .copy-text{font-size:.65rem;letter-spacing:.1em;}
        }
        @media(max-width:360px){
          .hc{padding:1.3rem 1rem;}
          .h-title{font-size:1.45rem;}
          .logo-ring{width:60px;height:60px;}
          .logo-ring img{width:44px;height:44px;}
          .logo-brand{font-size:1.25rem;}
        }
        @media(min-width:1400px){
          .lp{padding:0 10vw;}
          .hc{max-width:560px;}
          .h-title{font-size:3.5rem;}
          .h-desc{font-size:1.1rem;}
        }
        @media(max-width:480px){
          .ov{padding:.8rem;}
          .card{padding:1.8rem 1.4rem;border-radius:1rem;}
          .card-title{font-size:1rem;}
          .f-input{height:44px;font-size:.85rem;}
          .btn-sub{height:46px;font-size:.88rem;}
        }
      `}),e.jsx("div",{className:"lp",children:e.jsxs("div",{className:"hc",children:[e.jsxs("div",{className:"fu1 logo-wrap",children:[e.jsx("div",{className:"logo-ring",children:e.jsx("img",{src:"/logo.jpg",alt:"Caprina"})}),e.jsxs("div",{className:"logo-text-block",children:[e.jsx("span",{className:"logo-brand",children:"CAPRINA"}),e.jsx("span",{className:"logo-sub",children:"Operations System"})]})]}),e.jsx("div",{className:"fu2 gold-divider"}),e.jsx("div",{className:"fu2",children:e.jsxs("h1",{className:"h-title",children:["مرحباً بك في",e.jsx("br",{}),e.jsx("span",{className:"g",children:"مركز العمليات"})]})}),e.jsx("div",{className:"fu3",children:e.jsx("p",{className:"h-desc",children:"نظام متكامل لإدارة الطلبيات والعمليات وتنفيذها على نطاق واسع"})}),e.jsx("div",{className:"fu3",children:e.jsx("span",{className:"tagline",children:"WIN OR DIE"})}),e.jsxs("div",{className:"fu4 btn-row",children:[e.jsxs("button",{className:"btn-primary",onClick:()=>o(!0),children:[e.jsx(g,{size:18})," تسجيل الدخول"]}),e.jsxs("a",{href:"https://caprinaeg.com",target:"_blank",rel:"noopener noreferrer",className:"btn-ghost",children:[e.jsx(C,{size:18})," الموقع الرئيسي"]})]}),e.jsxs("div",{className:"fu5 copy-bar",children:[e.jsx("div",{className:"copy-line"}),e.jsx("span",{className:"copy-text",children:"جميع الحقوق محفوظة © CAPRINA 2026"}),e.jsx("div",{className:"copy-line r"})]})]})}),w&&e.jsx("div",{className:"ov",onClick:()=>o(!1),children:e.jsxs("div",{className:"card",onClick:r=>r.stopPropagation(),children:[e.jsx("div",{className:"card-top-line"}),e.jsxs("div",{className:"card-head",children:[e.jsxs("div",{className:"card-head-left",children:[e.jsx("div",{className:"card-icon",children:e.jsx(c,{size:19})}),e.jsxs("div",{children:[e.jsx("div",{className:"card-title",children:"تسجيل الدخول"}),e.jsx("div",{className:"card-sub",children:"أدخل بياناتك للمتابعة إلى لوحة التحكم"})]})]}),e.jsx("button",{className:"btn-x",onClick:()=>o(!1),children:e.jsx(F,{size:13})})]}),e.jsxs("form",{onSubmit:v,children:[e.jsxs("label",{className:"f-label",children:[e.jsx(p,{size:12})," اسم المستخدم"]}),e.jsxs("div",{className:"f-wrap",children:[e.jsx(p,{className:"f-ico-r",size:15}),e.jsx("input",{className:"f-input",value:t,onChange:r=>h(r.target.value),placeholder:"أدخل اسم المستخدم",autoComplete:"username",autoFocus:!0})]}),e.jsxs("label",{className:"f-label",children:[e.jsx(c,{size:12})," كلمة المرور"]}),e.jsxs("div",{className:"f-wrap",children:[e.jsx(Y,{className:"f-ico-r",size:15}),e.jsx("input",{className:"f-input",type:s?"text":"password",value:i,onChange:r=>f(r.target.value),placeholder:"••••••••",autoComplete:"current-password",style:{paddingLeft:"2.6rem"}}),e.jsx("button",{type:"button",className:"f-ico-l",onClick:()=>u(r=>!r),children:s?e.jsx(S,{size:14}):e.jsx(A,{size:14})})]}),e.jsx("button",{type:"submit",className:"btn-sub",disabled:l||!t.trim()||!i,children:l?e.jsx(e.Fragment,{children:"جاري التحقق..."}):e.jsxs(e.Fragment,{children:[e.jsx(g,{size:17})," دخول آمن"]})})]})]})})]})}export{O as default};
