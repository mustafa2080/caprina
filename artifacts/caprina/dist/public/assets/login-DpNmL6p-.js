import{j as e}from"./vendor-query-Bj6efJQO.js";import{u as j,r}from"./vendor-router-D4U-j562.js";import{i as v,u as w,d as N,E as S,L as m,I as c,B as k,F as L}from"./index-B36_iHIJ.js";import{al as B,L as C,am as E,af as z}from"./vendor-icons-CMIab_CS.js";import"./vendor-ui-0K0Ol4RT.js";import"./vendor-charts-BJCyhj9w.js";function I(){const{brand:o}=v(),{login:g}=w(),[,x]=j(),{toast:p}=N(),[s,u]=r.useState(""),[a,b]=r.useState(""),[i,h]=r.useState(!1),[n,d]=r.useState(!1),f=async t=>{if(t.preventDefault(),!(!s.trim()||!a)){d(!0);try{const{token:l,user:y}=await L.login(s.trim(),a);g(l,y),x("/")}catch(l){p({title:"خطأ في تسجيل الدخول",description:l.message,variant:"destructive"})}finally{d(!1)}}};return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
        .login-outer {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: transparent;
          z-index: 10;
        }
        /* On mobile: push form toward bottom so video is visible on top */
        @media (max-width: 640px) {
          .login-outer {
            align-items: flex-end;
            padding-bottom: 2.5rem;
          }
        }
        /* Very small screens (iPhone SE etc) */
        @media (max-width: 380px) {
          .login-outer {
            padding-bottom: 1.5rem;
          }
        }
        .login-logo {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 640px) {
          .login-logo {
            margin-bottom: 1rem;
          }
        }
      `}),e.jsx("div",{dir:"rtl",className:"login-outer",children:e.jsxs("div",{style:{width:"100%",maxWidth:"384px"},children:[e.jsxs("div",{className:"login-logo",children:[e.jsx("div",{style:{display:"flex",justifyContent:"center",marginBottom:"0.75rem"},children:e.jsx(S,{size:"lg"})}),e.jsx("h1",{style:{fontSize:"1.5rem",fontWeight:900,color:"#fff",letterSpacing:"-0.025em"},children:o.name}),o.tagline&&e.jsx("p",{style:{fontSize:"0.7rem",color:"rgba(255,255,255,0.6)",marginTop:"0.25rem",textTransform:"uppercase",letterSpacing:"0.1em"},children:o.tagline})]}),e.jsxs("div",{style:{background:"rgba(0,0,0,0.55)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"0.75rem",padding:"1.5rem",boxShadow:"0 25px 50px rgba(0,0,0,0.5)"},children:[e.jsx("h2",{style:{fontSize:"1.1rem",fontWeight:700,marginBottom:"1.25rem",color:"#fff"},children:"تسجيل الدخول"}),e.jsxs("form",{onSubmit:f,style:{display:"flex",flexDirection:"column",gap:"1rem"},children:[e.jsxs("div",{children:[e.jsx(m,{className:"text-xs mb-1.5 block",style:{color:"rgba(255,255,255,0.75)"},children:"اسم المستخدم"}),e.jsxs("div",{className:"relative",children:[e.jsx(B,{className:"absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4",style:{color:"rgba(255,255,255,0.4)"}}),e.jsx(c,{value:s,onChange:t=>u(t.target.value),placeholder:"admin",className:"pr-9 h-10 text-sm",style:{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff"},autoComplete:"username",autoFocus:!0})]})]}),e.jsxs("div",{children:[e.jsx(m,{className:"text-xs mb-1.5 block",style:{color:"rgba(255,255,255,0.75)"},children:"كلمة المرور"}),e.jsxs("div",{className:"relative",children:[e.jsx(C,{className:"absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4",style:{color:"rgba(255,255,255,0.4)"}}),e.jsx(c,{type:i?"text":"password",value:a,onChange:t=>b(t.target.value),placeholder:"••••••••",className:"pr-9 pl-9 h-10 text-sm",style:{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff"},autoComplete:"current-password"}),e.jsx("button",{type:"button",onClick:()=>h(t=>!t),className:"absolute left-3 top-1/2 -translate-y-1/2",style:{color:"rgba(255,255,255,0.4)"},children:i?e.jsx(E,{className:"w-4 h-4"}):e.jsx(z,{className:"w-4 h-4"})})]})]}),e.jsx(k,{type:"submit",className:"w-full h-10 font-bold bg-primary text-primary-foreground mt-1",disabled:n||!s.trim()||!a,children:n?"جاري تسجيل الدخول...":"دخول"})]})]})]})})]})}export{I as default};
