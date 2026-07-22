import{E as C,o as B,L as F}from"./index-D79Lg8g_.js";import{a as S,j as l}from"./vendor-query-BGjC7LOU.js";import{D as U,b as W,c as M,d as K,f as G}from"./dialog-CTSKsYSQ.js";import{I as J,B as R}from"./input-CIhZ-0Ag.js";import{L as V}from"./label-Cd_-Dr4W.js";import{M as A}from"./mail-CCrHFvgO.js";function p(o){return o.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}function w(o,n){if(o<=0)return"—";const s=Math.round(o*60),t=Math.floor(s/60),r=s%60;return n?t>0&&r>0?`${t}س ${r}د`:t>0?`${t}س`:`${r}د`:t>0&&r>0?`${t}h ${r}m`:t>0?`${t}h`:`${r}m`}function E(o,n){return n?{present:"حاضر",late:"متأخر",absent:"غائب",on_leave:"إجازة",early_leave:"خروج مبكر"}[o]??o:{present:"Present",late:"Late",absent:"Absent",on_leave:"On Leave",early_leave:"Early Leave"}[o]??o}function Y(o){return o==="absent"?"#dc2626":o==="late"||o==="early_leave"?"#d97706":o==="on_leave"?"#2563eb":"#16a34a"}function j(o){const{isArabic:n,appName:s,summary:t,records:r,payroll:a,payrollError:f,from:c,to:u,employeeName:g,appLogo:x}=o,b=n?"rtl":"ltr",e=(i,y)=>n?i:y,m=n?"right":"left",h=n?"left":"right",N=x?`<img src="${x}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;" />`:`<div style="width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff;">${(s||"A").charAt(0).toUpperCase()}</div>`,_=[{label:e("أيام الحضور","Present Days"),value:t.presentDays,color:"#16a34a"},{label:e("أيام الغياب","Absent Days"),value:t.absentDays,color:"#dc2626"},{label:e("ساعات العمل","Work Hours"),value:w(t.normalHours,n),color:"#4f46e5"},{label:e("ساعات إضافية","Overtime"),value:w(t.overtime,n),color:"#d97706"}].map(i=>`
    <div style="flex:1;min-width:110px;background:#fff;border-radius:10px;padding:14px 10px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.1);border-top:3px solid ${i.color};">
      <div style="font-size:22px;font-weight:900;color:${i.color};margin-bottom:4px;">${i.value}</div>
      <div style="font-size:11px;color:#6b7280;">${i.label}</div>
    </div>
  `).join(""),H=[[e("من تاريخ","From"),c],[e("إلى تاريخ","To"),u],[e("أيام العمل المتوقعة","Working Days"),t.workingDays],[e("الساعات المتوقعة","Expected Hours"),w(t.expectedHours,n)],[e("أيام الحضور","Present Days"),t.presentDays],[e("أيام الغياب","Absent Days"),t.absentDays],[e("أيام الإجازة","Leave Days"),t.leaveDays],[e("أيام التأخر","Late Days"),t.lateDays??0],[e("صافي ساعات العمل","Net Work Hours"),w(t.normalHours,n)],[e("ساعات الإضافي","Overtime Hours"),w(t.overtime,n)]].map((i,y)=>`
    <tr style="background:${y%2===0?"#f9fafb":"#fff"};">
      <td style="padding:7px 14px;color:#6b7280;font-size:12px;">${i[0]}</td>
      <td style="padding:7px 14px;font-weight:700;font-size:12px;text-align:${h};">${i[1]}</td>
    </tr>`).join("");let k="";if(f)k=`
      <div style="margin-top:24px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;">
        <div style="font-weight:700;color:#c2410c;font-size:13px;margin-bottom:4px;">
          ⚠️ ${e("تنبيه: قسم الراتب","Notice: Salary Section")}
        </div>
        <div style="font-size:12px;color:#92400e;">${f}</div>
      </div>`;else if(!a)k=`
      <div style="margin-top:24px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;">
        <div style="font-size:12px;color:#0369a1;">
          ℹ️ ${e("لم يتم ربط بيانات الراتب بهذا التقرير. لعرض الراتب، اختر موظفاً محدداً وتأكد من إعداد راتبه.","Payroll data was not linked to this report. To include salary, select a specific employee with a configured salary.")}
        </div>
      </div>`;else{const i=a.contractType==="daily",y=a.totalNormalHours??0,D=i?`${p(a.dailyRate)}/${e("يوم","day")} · ${p(a.hourlyRate)}/${e("ساعة","hr")} · ${y.toFixed(2)}h × ${p(a.hourlyRate)}`:`${p(a.dailyRate)} / ${e("يوم","day")} · ${p(a.hourlyRate)} / ${e("ساعة","hr")}`,v=[[e("الراتب الأساسي","Base Salary"),D,p(a.baseSalary),"#111827"],[e("مكافأة الإضافي","Overtime Bonus"),`${a.totalOvertimeHours} ${e("ساعة","h")} × ${p(a.hourlyRate)} × 1.5`,`+${p(a.overtimeBonus)}`,"#16a34a"],[e("خصم التأخر","Late Penalty"),`${a.totalLateMinutes} ${e("دقيقة","min")}`,`−${p(a.latePenalty)}`,"#dc2626"],[e("خصم الإجازة غير المدفوعة","Unpaid Leave Deduction"),"",`−${p(a.unpaidLeaveDeduction)}`,"#dc2626"],[e("خصم الغياب","Absence Deduction"),"",`−${p(a.absentDeduction??0)}`,"#dc2626"]];(a.bonusItems??[]).filter(d=>d.type==="bonus").forEach((d,$)=>{v.push([d.reason??e("مكافأة","Bonus"),d.source==="purchase"?e("مشتريات","Purchase"):e("مكافأة إدارية","Admin Bonus"),`+${p(d.amount)}`,"#16a34a"])}),(a.bonusItems??[]).filter(d=>d.type==="deduction").forEach(d=>{const $=d.source==="advance";v.push([d.reason??($?e("خصم سلفة","Advance Deduction"):e("خصم إداري","Admin Deduction")),$?e("سلفة","Advance"):e("خصم إداري","Admin"),`−${p(d.amount)}`,"#dc2626"])});const T=v.map((d,$)=>`
      <tr style="background:${$%2===0?"#f9fafb":"#fff"};">
        <td style="padding:9px 14px;font-size:12px;font-weight:700;">${d[0]}</td>
        <td style="padding:9px 14px;font-size:11px;color:#6b7280;">${d[1]}</td>
        <td style="padding:9px 14px;font-size:13px;font-weight:800;color:${d[3]};text-align:${h};">${d[2]}</td>
      </tr>`).join(""),I=a.netSalary>=a.baseSalary?"#dcfce7":"#fef3c7",P=a.netSalary>=a.baseSalary?"#16a34a":"#d97706";k=`
      <div style="margin-top:24px;page-break-inside:avoid;">
        <div style="background:#4f46e5;color:#fff;padding:11px 16px;border-radius:10px 10px 0 0;font-weight:800;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
          <span>💰 ${e("تفاصيل الراتب","Salary Breakdown")}</span>
          <span style="font-weight:500;font-size:11px;opacity:.85;">${a.period}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;">
          <thead>
            <tr style="background:#ede9fe;">
              <th style="padding:8px 14px;font-size:11px;color:#4f46e5;text-align:${m};font-weight:700;">${e("البند","Item")}</th>
              <th style="padding:8px 14px;font-size:11px;color:#4f46e5;text-align:${m};font-weight:700;">${e("التفاصيل","Details")}</th>
              <th style="padding:8px 14px;font-size:11px;color:#4f46e5;text-align:${h};font-weight:700;">${e("المبلغ","Amount")}</th>
            </tr>
          </thead>
          <tbody>${T}</tbody>
          <tfoot>
            <tr style="background:${I};">
              <td colspan="2" style="padding:12px 14px;font-size:14px;font-weight:900;">${e("✅ صافي الراتب","✅ Net Salary")}</td>
              <td style="padding:12px 14px;font-size:20px;font-weight:900;color:${P};text-align:${h};">${p(a.netSalary)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`}const z=o.isAdmin?[e("التاريخ","Date"),e("الموظف","Employee"),e("دخول","In"),e("خروج","Out"),e("العمل","Work"),e("إضافي","OT"),e("الحالة","Status")]:[e("التاريخ","Date"),e("دخول","In"),e("خروج","Out"),e("العمل","Work"),e("إضافي","OT"),e("الحالة","Status")],O=r.map((i,y)=>{const D=Y(i.status),v=o.isAdmin?[i.date,i.employee??"—",i.checkIn,i.checkOut,i.normalHours,i.overtime,`<span style="color:${D};font-weight:700;">${E(i.status,n)}</span>`]:[i.date,i.checkIn,i.checkOut,i.normalHours,i.overtime,`<span style="color:${D};font-weight:700;">${E(i.status,n)}</span>`];return`<tr style="background:${y%2===0?"#f9fafb":"#fff"};">
      ${v.map(L=>`<td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f0f0f0;">${L}</td>`).join("")}
    </tr>`}).join("");return`<!DOCTYPE html>
<html lang="${n?"ar":"en"}" dir="${b}">
<head>
<meta charset="UTF-8" />
<title>${s} — ${e("تقرير الحضور","Attendance Report")}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${n?"'Noto Sans Arabic','Tahoma','Arial',sans-serif":"'Inter','Arial',sans-serif"};
    background: #f3f4f6;
    color: #111827;
    direction: ${b};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { max-width: 900px; margin: 0 auto; padding: 24px; }
  .no-print { display: block; }
  @media print {
    body { background: #fff; }
    .page { padding: 0; max-width: 100%; }
    .no-print { display: none !important; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  }
  table { border-collapse: collapse; width: 100%; }
  th { font-weight: 700; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:16px;flex-wrap:wrap;">
    <div style="display:flex;align-items:center;gap:14px;">
      ${N}
      <div>
        <div style="font-size:20px;font-weight:900;">${s}</div>
        <div style="font-size:11px;opacity:.8;margin-top:2px;">${e("تقرير الحضور والرواتب","Attendance &amp; Payroll Report")}</div>
      </div>
    </div>
    <div style="text-align:${h};">
      ${g?`<div style="font-size:15px;font-weight:800;margin-bottom:4px;">${g}</div>`:""}
      <div style="font-size:12px;opacity:.85;">${c} → ${u}</div>
      <div style="font-size:10px;opacity:.65;margin-top:3px;">${e("تاريخ الإصدار","Generated")}: ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <!-- KPI Cards -->
  <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">${_}</div>

  <!-- Summary -->
  <div style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:20px;">
    <div style="background:#1e293b;color:#fff;padding:10px 16px;font-weight:800;font-size:13px;">
      📊 ${e("ملخص الفترة","Period Summary")}
    </div>
    <table>${H}</table>
  </div>

  <!-- Payroll -->
  ${k}

  <!-- Attendance Log -->
  <div style="margin-top:24px;">
    <div style="background:#111827;color:#fff;padding:11px 16px;border-radius:10px 10px 0 0;font-weight:800;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
      <span>📋 ${e("سجل الحضور التفصيلي","Detailed Attendance Log")}</span>
      <span style="font-weight:400;font-size:11px;opacity:.7;">${r.length} ${e("سجل","records")}</span>
    </div>
    <div style="overflow:auto;background:#fff;border-radius:0 0 10px 10px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <table>
        <thead>
          <tr style="background:#f3f4f6;">
            ${z.map(i=>`<th style="padding:9px 10px;font-size:11px;text-align:${m};border-bottom:2px solid #e5e7eb;white-space:nowrap;">${i}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${O||`<tr><td colspan="${z.length}" style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">${e("لا توجد سجلات","No records")}</td></tr>`}</tbody>
      </table>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;">
    <span>${s} · ${e("نظام إدارة الحضور","Attendance Management System")}</span>
    <span>${e("سري — للاستخدام الداخلي فقط","Confidential — Internal Use Only")}</span>
  </div>

</div>
</body>
</html>`}function q(o){var a;const n=document.getElementById("__pdf_print_frame__");n&&n.remove();const s=document.createElement("iframe");s.id="__pdf_print_frame__",s.style.cssText="position:fixed;top:-10000px;left:-10000px;width:1px;height:1px;border:none;visibility:hidden;",document.body.appendChild(s);const t=s.contentDocument||((a=s.contentWindow)==null?void 0:a.document);if(!t){s.remove();return}t.open(),t.write(o),t.close();const r=()=>{var f,c;try{(f=s.contentWindow)==null||f.focus(),(c=s.contentWindow)==null||c.print()}catch{}setTimeout(()=>s.remove(),6e4)};t.readyState==="complete"?setTimeout(r,500):s.onload=()=>setTimeout(r,500)}function ie(o){const n=j(o),s=new Blob([n],{type:"text/html;charset=utf-8"}),t=URL.createObjectURL(s),r=document.createElement("a");r.href=t,r.target="_blank",r.rel="noopener noreferrer",document.body.appendChild(r),r.click(),document.body.removeChild(r),setTimeout(()=>URL.revokeObjectURL(t),1e4)}function se(o){const n=j(o);q(n)}async function re(o,n,s){const t=j(s),r=await C(B("/api/reports/send-email"),{method:"POST",body:JSON.stringify({to:o,subject:n,html:t})});if(!r.ok){const a=await r.json().catch(()=>({}));throw new Error((a==null?void 0:a.error)||"Failed to send email")}}function de({open:o,onOpenChange:n,defaultEmail:s,isArabic:t,onSend:r}){const[a,f]=S.useState(s??""),[c,u]=S.useState(!1),[g,x]=S.useState("");S.useEffect(()=>{o&&(f(s??""),x(""))},[o,s]);const b=async()=>{const e=a.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){x(t?"أدخل بريداً إلكترونياً صحيحاً":"Enter a valid email address");return}u(!0),x("");try{await r(e),n(!1)}catch(m){x((m==null?void 0:m.message)||(t?"فشل إرسال البريد":"Failed to send email"))}finally{u(!1)}};return l.jsx(U,{open:o,onOpenChange:e=>{c||n(e)},children:l.jsxs(W,{className:"max-w-sm",children:[l.jsx(M,{children:l.jsxs(K,{className:"flex items-center gap-2",children:[l.jsx(A,{className:"w-4 h-4"}),t?"إرسال التقرير عبر البريد":"Send Report by Email"]})}),l.jsxs("div",{className:"space-y-2 py-2",children:[l.jsx(V,{className:"text-xs text-muted-foreground",children:t?"البريد الإلكتروني للمستلم":"Recipient email"}),l.jsx(J,{type:"email",autoFocus:!0,value:a,onChange:e=>f(e.target.value),placeholder:"name@example.com",onKeyDown:e=>{e.key==="Enter"&&b()}}),g&&l.jsx("p",{className:"text-xs text-destructive",children:g})]}),l.jsxs(G,{children:[l.jsx(R,{variant:"outline",onClick:()=>n(!1),disabled:c,children:t?"إلغاء":"Cancel"}),l.jsxs(R,{onClick:b,disabled:c,className:"gap-2",children:[c?l.jsx(F,{className:"w-4 h-4 animate-spin"}):l.jsx(A,{className:"w-4 h-4"}),t?"إرسال":"Send"]})]})]})})}export{de as E,re as a,ie as e,se as s};
