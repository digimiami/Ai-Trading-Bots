import{r as $,j as e,g as W,s as F}from"./index-41a0ae00.js";import{H as M}from"./Header-b24d545e.js";import{N as G}from"./Navigation-ce370d60.js";import{B as E}from"./Button-0b498d06.js";import{C as R}from"./Card-0516a8f2.js";import{u as V}from"./useBotActivity-466560f7.js";import{u as Y}from"./useBots-73934354.js";function q({activity:t,onClearLogs:n,onSimulateActivity:h}){const[S,L]=$.useState(!1),[y,T]=$.useState("all"),[p,j]=$.useState("");$.useEffect(()=>{const m=()=>{if(t.lastActivity){const B=Date.now()-new Date(t.lastActivity).getTime(),P=Math.floor(B/1e3),x=Math.floor(P/60),v=Math.floor(x/60);v>0?j(`${v}h ${x%60}m ago`):x>0?j(`${x}m ${P%60}s ago`):j(`${P}s ago`)}};m();const k=setInterval(m,1e3);return()=>clearInterval(k)},[t.lastActivity]);const i=m=>{switch(m){case"info":return"text-blue-600 bg-blue-50";case"warning":return"text-yellow-600 bg-yellow-50";case"error":return"text-red-600 bg-red-50";case"success":return"text-green-600 bg-green-50";default:return"text-gray-600 bg-gray-50"}},A=m=>{switch(m){case"market":return"ri-line-chart-line";case"trade":return"ri-exchange-line";case"strategy":return"ri-brain-line";case"system":return"ri-settings-line";case"error":return"ri-error-warning-line";default:return"ri-information-line"}},u=m=>{switch(m){case"running":return"ri-play-circle-fill text-green-500";case"paused":return"ri-pause-circle-fill text-yellow-500";case"stopped":return"ri-stop-circle-fill text-red-500";default:return"ri-question-mark-circle-fill text-gray-500"}},l=m=>{switch(m){case"executing":return{icon:"ri-loader-4-line animate-spin",color:"bg-purple-100 text-purple-800 border-purple-200",label:"Executing",badge:"Executing Trade"};case"analyzing":return{icon:"ri-bar-chart-line",color:"bg-blue-100 text-blue-800 border-blue-200",label:"Analyzing",badge:"Analyzing Market"};case"waiting":return{icon:"ri-time-line",color:"bg-yellow-100 text-yellow-800 border-yellow-200",label:"Waiting",badge:"Waiting for Signal"};case"error":return{icon:"ri-error-warning-line",color:"bg-red-100 text-red-800 border-red-200",label:"Error",badge:"Error Detected"};case"idle":return{icon:"ri-pause-line",color:"bg-gray-100 text-gray-800 border-gray-200",label:"Idle",badge:"Not Running"};default:return{icon:"ri-question-line",color:"bg-gray-100 text-gray-800 border-gray-200",label:"Unknown",badge:"Unknown State"}}},g=t.logs.filter(m=>y==="all"||m.level===y),r=t.logs.find(m=>{var k,B;return((k=m.message)==null?void 0:k.includes("Performance Update"))||((B=m.details)==null?void 0:B.winTrades)!==void 0}),a=(r==null?void 0:r.details)||null,o=(a==null?void 0:a.winTrades)||0,w=(a==null?void 0:a.lossTrades)||0,b=(a==null?void 0:a.drawdown)||0,f=(a==null?void 0:a.drawdownPercentage)||0,s=(a==null?void 0:a.winRate)||0,_=(a==null?void 0:a.totalTrades)||0,c=m=>new Date(m).toLocaleTimeString();return e.jsxs(R,{className:"p-4",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsxs("div",{className:"flex items-center space-x-3 flex-1",children:[e.jsx("i",{className:`${u(t.status)} text-xl`}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-1",children:[e.jsx("h3",{className:"font-semibold text-gray-900",children:t.botName}),t.executionState&&e.jsxs("span",{className:`px-2 py-0.5 rounded-full text-xs font-medium border ${l(t.executionState).color}`,children:[e.jsx("i",{className:`${l(t.executionState).icon} mr-1`}),l(t.executionState).badge]})]}),e.jsx("p",{className:"text-sm text-gray-600 mb-1",children:t.currentAction||"No recent activity"}),e.jsxs("div",{className:"flex items-center gap-3 text-xs text-gray-500",children:[p&&e.jsxs("span",{children:[e.jsx("i",{className:"ri-time-line mr-1"}),p]}),t.lastExecutionTime&&e.jsxs("span",{children:[e.jsx("i",{className:"ri-exchange-line mr-1"}),"Last trade: ",new Date(t.lastExecutionTime).toLocaleString()]})]})]})]}),e.jsxs("div",{className:"flex items-center space-x-2",children:[e.jsx("span",{className:`px-2 py-1 rounded-full text-xs font-medium ${t.isActive?"bg-green-100 text-green-800":"bg-gray-100 text-gray-800"}`,children:t.status}),e.jsx(E,{variant:"secondary",size:"sm",onClick:()=>L(!S),children:e.jsx("i",{className:`ri-${S?"arrow-up":"arrow-down"}-line`})})]})]}),a&&e.jsxs("div",{className:"mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg",children:[e.jsxs("div",{className:"flex items-center justify-between mb-3",children:[e.jsxs("h4",{className:"text-sm font-semibold text-gray-900 flex items-center",children:[e.jsx("i",{className:"ri-line-chart-line mr-2 text-blue-600"}),"Performance Metrics"]}),r&&e.jsxs("span",{className:"text-xs text-gray-500",children:["Updated: ",c(r.timestamp)]})]}),e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-3",children:[e.jsxs("div",{className:"bg-white rounded-lg p-3 border border-green-200",children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsx("span",{className:"text-xs text-gray-600",children:"Win Trades"}),e.jsx("i",{className:"ri-arrow-up-line text-green-600"})]}),e.jsx("div",{className:"text-xl font-bold text-green-600",children:o}),e.jsxs("div",{className:"text-xs text-gray-500",children:[_>0?`${(o/_*100).toFixed(1)}%`:"0%"," of total"]})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3 border border-red-200",children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsx("span",{className:"text-xs text-gray-600",children:"Loss Trades"}),e.jsx("i",{className:"ri-arrow-down-line text-red-600"})]}),e.jsx("div",{className:"text-xl font-bold text-red-600",children:w}),e.jsxs("div",{className:"text-xs text-gray-500",children:[_>0?`${(w/_*100).toFixed(1)}%`:"0%"," of total"]})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3 border border-blue-200",children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsx("span",{className:"text-xs text-gray-600",children:"Win Rate"}),e.jsx("i",{className:"ri-percent-line text-blue-600"})]}),e.jsxs("div",{className:"text-xl font-bold text-blue-600",children:[s.toFixed(1),"%"]}),e.jsxs("div",{className:"text-xs text-gray-500",children:[_," total trades"]})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3 border border-orange-200",children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsx("span",{className:"text-xs text-gray-600",children:"Drawdown"}),e.jsx("i",{className:"ri-line-chart-line text-orange-600"})]}),e.jsxs("div",{className:"text-xl font-bold text-orange-600",children:["$",b.toFixed(2)]}),e.jsxs("div",{className:"text-xs text-gray-500",children:[f.toFixed(1),"% of peak"]})]})]}),a.peakPnL!==void 0&&e.jsxs("div",{className:"mt-3 pt-3 border-t border-blue-200 grid grid-cols-2 gap-2 text-xs",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-gray-600",children:"Peak P&L:"}),e.jsxs("span",{className:"font-medium text-green-600",children:["$",(a.peakPnL||0).toFixed(2)]})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-gray-600",children:"Current P&L:"}),e.jsxs("span",{className:`font-medium ${(a.currentPnL||0)>=0?"text-green-600":"text-red-600"}`,children:["$",(a.currentPnL||0).toFixed(2)]})]})]})]}),e.jsxs("div",{className:"grid grid-cols-4 gap-4 mb-4",children:[e.jsxs("div",{className:"text-center",children:[e.jsx("div",{className:"text-lg font-bold text-blue-600",children:t.logs.length}),e.jsx("div",{className:"text-xs text-gray-500",children:"Total Logs"})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("div",{className:"text-lg font-bold text-green-600",children:t.successCount}),e.jsx("div",{className:"text-xs text-gray-500",children:"Success"})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("div",{className:"text-lg font-bold text-yellow-600",children:t.logs.filter(m=>m.level==="warning").length}),e.jsx("div",{className:"text-xs text-gray-500",children:"Warnings"})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("div",{className:"text-lg font-bold text-red-600",children:t.errorCount}),e.jsx("div",{className:"text-xs text-gray-500",children:"Errors"})]})]}),e.jsx("div",{className:"mb-4 p-3 rounded-lg border-2",style:{backgroundColor:t.executionState==="executing"?"#f3e8ff":t.executionState==="analyzing"?"#eff6ff":t.executionState==="waiting"?"#fefce8":t.executionState==="error"?"#fef2f2":"#f9fafb",borderColor:t.executionState==="executing"?"#c084fc":t.executionState==="analyzing"?"#60a5fa":t.executionState==="waiting"?"#eab308":t.executionState==="error"?"#f87171":"#e5e7eb"},children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center space-x-2",children:[t.executionState&&e.jsx("i",{className:`${l(t.executionState).icon} text-lg ${t.executionState==="executing"?"text-purple-600":t.executionState==="analyzing"?"text-blue-600":t.executionState==="waiting"?"text-yellow-600":t.executionState==="error"?"text-red-600":"text-gray-600"}`}),e.jsxs("div",{children:[e.jsxs("span",{className:`text-sm font-medium ${t.executionState==="executing"?"text-purple-800":t.executionState==="analyzing"?"text-blue-800":t.executionState==="waiting"?"text-yellow-800":t.executionState==="error"?"text-red-800":"text-gray-800"}`,children:[t.executionState?l(t.executionState).label:"Status",":"]}),e.jsx("span",{className:`ml-2 text-sm ${t.executionState==="executing"?"text-purple-700":t.executionState==="analyzing"?"text-blue-700":t.executionState==="waiting"?"text-yellow-700":t.executionState==="error"?"text-red-700":"text-gray-700"}`,children:t.currentAction||"No activity"})]})]}),t.waitingFor&&e.jsxs("div",{className:"text-xs text-gray-600",children:[e.jsx("i",{className:"ri-hourglass-line mr-1"}),t.waitingFor]})]})}),S&&e.jsxs("div",{className:"space-y-4",children:[e.jsx("div",{className:"flex space-x-2",children:["all","info","warning","error","success"].map(m=>e.jsx("button",{onClick:()=>T(m),className:`px-3 py-1 rounded-full text-xs font-medium ${y===m?"bg-blue-600 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`,children:m.charAt(0).toUpperCase()+m.slice(1)},m))}),e.jsx("div",{className:"max-h-96 overflow-y-auto space-y-2",children:g.length===0?e.jsxs("div",{className:"text-center py-8 text-gray-500",children:[e.jsx("i",{className:"ri-file-list-line text-2xl mb-2"}),e.jsx("p",{children:"No logs found"})]}):g.map(m=>e.jsxs("div",{className:"flex items-start space-x-3 p-3 bg-gray-50 rounded-lg",children:[e.jsx("div",{className:`w-8 h-8 rounded-full flex items-center justify-center ${i(m.level)}`,children:e.jsx("i",{className:`${A(m.category)} text-sm`})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsx("span",{className:`px-2 py-1 rounded-full text-xs font-medium ${i(m.level)}`,children:m.level}),e.jsx("span",{className:"text-xs text-gray-500",children:c(m.timestamp)})]}),e.jsx("p",{className:"text-sm text-gray-900 mb-1",children:m.message}),m.details&&e.jsxs("details",{className:"text-xs text-gray-600",children:[e.jsx("summary",{className:"cursor-pointer hover:text-gray-800",children:"Details"}),e.jsx("pre",{className:"mt-1 p-2 bg-white rounded border text-xs overflow-x-auto",children:JSON.stringify(m.details,null,2)})]})]})]},m.id))}),e.jsxs("div",{className:"flex space-x-2 pt-4 border-t border-gray-200",children:[e.jsxs(E,{variant:"secondary",size:"sm",onClick:()=>h(t.botId),children:[e.jsx("i",{className:"ri-play-line mr-1"}),"Simulate Activity"]}),e.jsxs(E,{variant:"danger",size:"sm",onClick:()=>n(t.botId),children:[e.jsx("i",{className:"ri-delete-bin-line mr-1"}),"Clear Logs"]})]})]})]})}const z={}.VITE_PUBLIC_SUPABASE_URL||{}.VITE_SUPABASE_URL,J={}.VITE_PUBLIC_SUPABASE_ANON_KEY||{}.VITE_SUPABASE_ANON_KEY;async function H(){const t=W(z,J),{data:{session:n}}=await t.auth.getSession();if(!n)throw new Error("Not authenticated");const h=await fetch(`${z}/functions/v1/bot-report`,{method:"GET",headers:{Authorization:`Bearer ${n.access_token}`,"Content-Type":"application/json"}});if(!h.ok){const L=await h.json();throw new Error(L.error||"Failed to generate report")}return(await h.json()).report}function K(){const[t,n]=$.useState(null),[h,S]=$.useState(!1),[L,y]=$.useState(null),T=async()=>{S(!0),y(null);try{const i=await H();n(i)}catch(i){y(i.message||"Failed to generate report")}finally{S(!1)}},p=i=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(i),j=(i,A)=>{if(i)if(A==="json"){const u=JSON.stringify(i,null,2),l=new Blob([u],{type:"application/json"}),g=URL.createObjectURL(l),r=document.createElement("a");r.href=g,r.download=`bot-performance-report-${new Date().toISOString().split("T")[0]}.json`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(g)}else{let u=`Bot Performance Report
`;u+=`Generated: ${new Date(i.generated_at).toLocaleString()}

`,u+=`OVERVIEW SUMMARY
`,u+=`Total Bots,${i.overview.total_bots}
`,u+=`Active Bots,${i.overview.active_bots}
`,u+=`Total P&L,${i.overview.total_pnl.toFixed(2)}
`,u+=`Total Fees Paid,${i.overview.total_fees.toFixed(2)}
`,u+=`Net Profit/Loss,${i.overview.net_profit_loss.toFixed(2)}
`,u+=`Total Trades,${i.overview.total_trades}

`,i.contract_summary&&i.contract_summary.length>0&&(u+=`CONTRACT PERFORMANCE
`,u+=`Contract,Exchange,Trades,Total P&L,Total Fees Paid,Net Profit/Loss
`,i.contract_summary.forEach(a=>{u+=`${a.contract},${a.exchange},${a.total_trades},${a.total_net_pnl.toFixed(2)},${a.total_fees_paid.toFixed(2)},${a.net_profit_loss.toFixed(2)}
`}),u+=`
`),i.active_bots&&i.active_bots.length>0&&(u+=`ACTIVE BOTS
`,u+=`Bot Name,Symbol,Exchange,P&L,Total Fees,Net Profit/Loss,Total Trades,Win Rate
`,i.active_bots.forEach(a=>{u+=`${a.name},${a.symbol},${a.exchange},${a.pnl.toFixed(2)},${(a.total_fees||0).toFixed(2)},${(a.net_profit_loss||0).toFixed(2)},${a.total_trades},${a.win_rate.toFixed(2)}%
`}));const l=new Blob([u],{type:"text/csv;charset=utf-8;"}),g=URL.createObjectURL(l),r=document.createElement("a");r.href=g,r.download=`bot-performance-report-${new Date().toISOString().split("T")[0]}.csv`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(g)}};return e.jsxs(R,{className:"p-6",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-lg font-semibold text-gray-900",children:"Bot Performance Report"}),e.jsx("p",{className:"text-sm text-gray-500",children:"Generate comprehensive report with P&L and fees"})]}),e.jsxs("div",{className:"flex space-x-2",children:[t&&e.jsxs(E,{variant:"secondary",onClick:()=>j(t,"csv"),children:[e.jsx("i",{className:"ri-download-line mr-2"}),"Download CSV"]}),t&&e.jsxs(E,{variant:"secondary",onClick:()=>j(t,"json"),children:[e.jsx("i",{className:"ri-download-line mr-2"}),"Download JSON"]}),e.jsx(E,{variant:"primary",onClick:T,disabled:h,children:h?e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"ri-loader-4-line animate-spin mr-2"}),"Generating..."]}):e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"ri-file-chart-line mr-2"}),"Generate Report"]})})]})]}),L&&e.jsx("div",{className:"mb-4 p-3 bg-red-50 border border-red-200 rounded-lg",children:e.jsx("p",{className:"text-red-600 text-sm",children:L})}),t&&e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"border-l-4 border-blue-500 pl-4",children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3",children:"Overview Summary"}),e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-4",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-blue-600",children:t.overview.total_bots}),e.jsx("div",{className:"text-sm text-gray-500",children:"Total Bots"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-green-600",children:t.overview.active_bots}),e.jsx("div",{className:"text-sm text-gray-500",children:"Active Bots"})]}),e.jsxs("div",{children:[e.jsx("div",{className:`text-2xl font-bold ${t.overview.total_pnl>=0?"text-green-600":"text-red-600"}`,children:p(t.overview.total_pnl)}),e.jsx("div",{className:"text-sm text-gray-500",children:"Total P&L"})]}),e.jsxs("div",{children:[e.jsx("div",{className:`text-2xl font-bold ${t.overview.net_profit_loss>=0?"text-green-600":"text-red-600"}`,children:p(t.overview.net_profit_loss)}),e.jsx("div",{className:"text-sm text-gray-500",children:"Net Profit/Loss"})]})]}),e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-3 gap-4 mt-4",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-lg font-semibold text-gray-700",children:p(t.overview.total_fees)}),e.jsx("div",{className:"text-xs text-gray-500",children:"Total Fees Paid"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-lg font-semibold text-gray-700",children:t.overview.total_trades}),e.jsx("div",{className:"text-xs text-gray-500",children:"Total Trades"})]}),e.jsx("div",{children:e.jsxs("div",{className:"text-xs text-gray-500",children:["Generated: ",new Date(t.generated_at).toLocaleString()]})})]})]}),t.contract_summary&&t.contract_summary.length>0&&e.jsxs("div",{children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3",children:"Contract Performance"}),e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-gray-200",children:[e.jsx("th",{className:"text-left py-2 px-3",children:"Contract"}),e.jsx("th",{className:"text-left py-2 px-3",children:"Exchange"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Trades"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Win/Loss"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Win Rate"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Total P&L"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Fees"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Net Profit/Loss"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Drawdown"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Peak/Current P&L"})]})}),e.jsx("tbody",{children:t.contract_summary.map((i,A)=>e.jsxs("tr",{className:"border-b border-gray-100",children:[e.jsx("td",{className:"py-2 px-3 font-medium",children:i.contract}),e.jsx("td",{className:"py-2 px-3 text-gray-600",children:i.exchange}),e.jsx("td",{className:"py-2 px-3 text-right",children:i.total_trades}),e.jsxs("td",{className:"py-2 px-3 text-right",children:[e.jsx("span",{className:"text-green-600 font-medium",children:i.win_trades||0}),e.jsx("span",{className:"text-gray-400 mx-1",children:"/"}),e.jsx("span",{className:"text-red-600 font-medium",children:i.loss_trades||0})]}),e.jsx("td",{className:"py-2 px-3 text-right",children:e.jsxs("span",{className:`font-medium ${(i.win_rate||0)>=50?"text-green-600":"text-red-600"}`,children:[(i.win_rate||0).toFixed(1),"%"]})}),e.jsx("td",{className:`py-2 px-3 text-right font-medium ${i.total_net_pnl>=0?"text-green-600":"text-red-600"}`,children:p(i.total_net_pnl)}),e.jsx("td",{className:"py-2 px-3 text-right text-gray-600",children:p(i.total_fees_paid)}),e.jsx("td",{className:`py-2 px-3 text-right font-semibold ${i.net_profit_loss>=0?"text-green-600":"text-red-600"}`,children:p(i.net_profit_loss)}),e.jsxs("td",{className:"py-2 px-3 text-right",children:[e.jsx("div",{className:"text-red-600 font-medium",children:p(i.drawdown||0)}),e.jsxs("div",{className:"text-xs text-gray-500",children:[(i.drawdown_percentage||0).toFixed(1),"%"]})]}),e.jsxs("td",{className:"py-2 px-3 text-right",children:[e.jsx("div",{className:"text-green-600 font-medium",children:p(i.peak_pnl||0)}),e.jsx("div",{className:`text-xs font-medium ${(i.current_pnl||0)>=0?"text-green-600":"text-red-600"}`,children:p(i.current_pnl||0)})]})]},A))})]})})]}),t.active_bots&&t.active_bots.length>0&&e.jsxs("div",{children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3",children:"Active Bots"}),e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-gray-200",children:[e.jsx("th",{className:"text-left py-2 px-3",children:"Bot Name"}),e.jsx("th",{className:"text-left py-2 px-3",children:"Symbol"}),e.jsx("th",{className:"text-left py-2 px-3",children:"Exchange"}),e.jsx("th",{className:"text-right py-2 px-3",children:"P&L"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Fees"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Net Profit/Loss"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Trades"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Win/Loss"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Win Rate"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Drawdown"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Peak/Current P&L"})]})}),e.jsx("tbody",{children:t.active_bots.map(i=>e.jsxs("tr",{className:"border-b border-gray-100",children:[e.jsx("td",{className:"py-2 px-3 font-medium",children:i.name}),e.jsx("td",{className:"py-2 px-3 text-gray-600",children:i.symbol}),e.jsx("td",{className:"py-2 px-3 text-gray-600",children:i.exchange}),e.jsx("td",{className:`py-2 px-3 text-right font-medium ${i.pnl>=0?"text-green-600":"text-red-600"}`,children:p(i.pnl)}),e.jsx("td",{className:"py-2 px-3 text-right text-gray-600",children:p(i.total_fees||0)}),e.jsx("td",{className:`py-2 px-3 text-right font-semibold ${(i.net_profit_loss||0)>=0?"text-green-600":"text-red-600"}`,children:p(i.net_profit_loss||0)}),e.jsx("td",{className:"py-2 px-3 text-right",children:i.total_trades}),e.jsxs("td",{className:"py-2 px-3 text-right",children:[e.jsx("span",{className:"text-green-600 font-medium",children:i.win_trades||0}),e.jsx("span",{className:"text-gray-400 mx-1",children:"/"}),e.jsx("span",{className:"text-red-600 font-medium",children:i.loss_trades||0})]}),e.jsx("td",{className:"py-2 px-3 text-right",children:e.jsxs("span",{className:`font-medium ${i.win_rate>=50?"text-green-600":"text-red-600"}`,children:[i.win_rate.toFixed(1),"%"]})}),e.jsxs("td",{className:"py-2 px-3 text-right",children:[e.jsx("div",{className:"text-red-600 font-medium",children:p(i.drawdown||0)}),e.jsxs("div",{className:"text-xs text-gray-500",children:[(i.drawdown_percentage||0).toFixed(1),"%"]})]}),e.jsxs("td",{className:"py-2 px-3 text-right",children:[e.jsx("div",{className:"text-green-600 font-medium",children:p(i.peak_pnl||0)}),e.jsx("div",{className:`text-xs font-medium ${(i.current_pnl||0)>=0?"text-green-600":"text-red-600"}`,children:p(i.current_pnl||0)})]})]},i.id))})]})})]})]})]})}async function Q(t,n){const{data:{user:h}}=await F.auth.getUser();if(!h)throw new Error("Not authenticated");const S=n||new Date,L=t||new Date(Date.now()-7*24*60*60*1e3),{data:y,error:T}=await F.from("trading_bots").select("id, name, status").eq("user_id",h.id);if(T)throw T;const p=(y==null?void 0:y.map(x=>x.id))||[];let j=[];if(p.length>0){const{data:x,error:v}=await F.from("bot_activity_logs").select("*").in("bot_id",p).gte("timestamp",L.toISOString()).lte("timestamp",S.toISOString()).order("timestamp",{ascending:!1}).limit(1e4);if(v)throw v;j=x||[]}const{data:i,error:A}=await F.from("trades").select("pnl, status, created_at").eq("user_id",h.id).gte("created_at",L.toISOString()).lte("created_at",S.toISOString());if(A)throw A;const u=(y==null?void 0:y.length)||0,l=(y==null?void 0:y.filter(x=>x.status==="running").length)||0,g=j.length,r=j.filter(x=>x.level==="error").length,a=j.filter(x=>x.level==="warning").length,o=j.filter(x=>x.level==="success").length,w=j.filter(x=>x.level==="info").length,b=(i==null?void 0:i.filter(x=>x.status==="filled"||x.status==="closed"))||[],f=b.length,s=b.reduce((x,v)=>{const d=parseFloat(v.pnl||"0")||0;return x+(isNaN(d)?0:d)},0),_=b.filter(x=>{const v=parseFloat(x.pnl||"0")||0;return!isNaN(v)&&v>0}).length,c=f>0?_/f*100:0,m=new Map;y==null||y.forEach(x=>{m.set(x.id,{bot_id:x.id,bot_name:x.name,status:x.status,total_logs:0,errors:0,warnings:0,successes:0,last_activity:"",recent_logs:[]})}),j.forEach(x=>{const v=m.get(x.bot_id);v&&(v.total_logs++,x.level==="error"&&v.errors++,x.level==="warning"&&v.warnings++,x.level==="success"&&v.successes++,(!v.last_activity||x.timestamp>v.last_activity)&&(v.last_activity=x.timestamp),v.recent_logs.length<10&&v.recent_logs.push({timestamp:x.timestamp,level:x.level,category:x.category,message:x.message,details:x.details}))});const k=[];m.forEach((x,v)=>{var d;if(x.errors>0){const N=j.filter(D=>D.bot_id===v&&D.level==="error"),C=N.map(D=>D.message),U=Array.from(new Set(C.slice(0,5)));k.push({bot_name:x.bot_name,error_count:x.errors,last_error:((d=N[0])==null?void 0:d.timestamp)||"",common_errors:U})}});const{data:B}=await F.from("trading_bots").select("id, pnl").eq("user_id",h.id).in("id",p),P=(B==null?void 0:B.filter(x=>(parseFloat(x.pnl||"0")||0)>0).length)||0;return{generated_at:new Date().toISOString(),period:{start:L.toISOString(),end:S.toISOString()},overview:{total_bots:u,active_bots:l,total_logs:g,errors:r,warnings:a,successes:o,info_logs:w},bot_activity:Array.from(m.values()),performance_summary:{total_trades:f||0,total_pnl:s||0,win_rate:c||0,profitable_bots:P||0},errors_summary:k}}function X(){var l,g,r;const[t,n]=$.useState(null),[h,S]=$.useState(!1),[L,y]=$.useState(null),[T,p]=$.useState("7d"),j=async()=>{S(!0),y(null);try{let a;const o=new Date;switch(T){case"7d":a=new Date(Date.now()-7*24*60*60*1e3);break;case"30d":a=new Date(Date.now()-30*24*60*60*1e3);break;case"60d":a=new Date(Date.now()-60*24*60*60*1e3);break;case"90d":a=new Date(Date.now()-90*24*60*60*1e3);break;default:a=new Date(Date.now()-7*24*60*60*1e3)}const w=await Q(a,o);n(w)}catch(a){y(a.message||"Failed to generate report"),console.error("Report generation error:",a)}finally{S(!1)}},i=()=>{if(!t)return;const a=Z(t),o=window.open("","_blank");o&&(o.document.write(a),o.document.close(),o.focus(),setTimeout(()=>{o.print()},250))},A=()=>{var f;if(!t)return;let a=`Activity Report
`;a+=`Generated: ${new Date(t.generated_at).toLocaleString()}
`,a+=`Period: ${new Date(t.period.start).toLocaleDateString()} - ${new Date(t.period.end).toLocaleDateString()}

`,a+=`OVERVIEW
`,a+=`Total Bots,${t.overview.total_bots}
`,a+=`Active Bots,${t.overview.active_bots}
`,a+=`Total Logs,${t.overview.total_logs}
`,a+=`Errors,${t.overview.errors}
`,a+=`Warnings,${t.overview.warnings}
`,a+=`Successes,${t.overview.successes}
`,a+=`Info Logs,${t.overview.info_logs}

`,a+=`PERFORMANCE SUMMARY
`,a+=`Total Trades,${t.performance_summary.total_trades}
`,a+=`Total P&L,${(((f=t.performance_summary)==null?void 0:f.total_pnl)||0).toFixed(2)}
`,a+=`Win Rate,${t.performance_summary.win_rate.toFixed(2)}%
`,a+=`Profitable Bots,${t.performance_summary.profitable_bots}

`,a+=`BOT ACTIVITY
`,a+=`Bot Name,Status,Total Logs,Errors,Warnings,Successes,Last Activity
`,t.bot_activity.forEach(s=>{a+=`${s.bot_name},${s.status},${s.total_logs},${s.errors},${s.warnings},${s.successes},${new Date(s.last_activity).toLocaleString()}
`}),a+=`
`,t.errors_summary.length>0&&(a+=`ERRORS SUMMARY
`,a+=`Bot Name,Error Count,Last Error,Common Errors
`,t.errors_summary.forEach(s=>{a+=`${s.bot_name},${s.error_count},${new Date(s.last_error).toLocaleString()},"${s.common_errors.join("; ")}"
`}));const o=new Blob([a],{type:"text/csv;charset=utf-8;"}),w=URL.createObjectURL(o),b=document.createElement("a");b.href=w,b.download=`activity-report-${new Date().toISOString().split("T")[0]}.csv`,document.body.appendChild(b),b.click(),document.body.removeChild(b),URL.revokeObjectURL(w)},u=()=>{if(!t)return;const a=JSON.stringify(t,null,2),o=new Blob([a],{type:"application/json"}),w=URL.createObjectURL(o),b=document.createElement("a");b.href=w,b.download=`activity-report-${new Date().toISOString().split("T")[0]}.json`,document.body.appendChild(b),b.click(),document.body.removeChild(b),URL.revokeObjectURL(w)};return e.jsxs(R,{className:"p-6",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsxs("div",{children:[e.jsxs("h3",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[e.jsx("i",{className:"ri-file-chart-2-line mr-2 text-blue-600"}),"Activity Report Generator"]}),e.jsx("p",{className:"text-sm text-gray-500 mt-1",children:"Generate comprehensive reports from bot activity logs"})]}),e.jsxs("div",{className:"flex space-x-2",children:[t&&e.jsxs(e.Fragment,{children:[e.jsxs(E,{variant:"secondary",size:"sm",onClick:i,children:[e.jsx("i",{className:"ri-file-pdf-line mr-2"}),"Export PDF"]}),e.jsxs(E,{variant:"secondary",size:"sm",onClick:A,children:[e.jsx("i",{className:"ri-file-excel-line mr-2"}),"Export CSV"]}),e.jsxs(E,{variant:"secondary",size:"sm",onClick:u,children:[e.jsx("i",{className:"ri-file-code-line mr-2"}),"Export JSON"]})]}),e.jsx(E,{variant:"primary",size:"sm",onClick:j,disabled:h,children:h?e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"ri-loader-4-line animate-spin mr-2"}),"Generating..."]}):e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"ri-file-chart-line mr-2"}),"Generate Report"]})})]})]}),e.jsxs("div",{className:"mb-4",children:[e.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Report Period"}),e.jsx("div",{className:"flex space-x-2",children:["7d","30d","60d","90d"].map(a=>e.jsxs("button",{onClick:()=>p(a),className:`px-3 py-2 rounded text-sm font-medium ${T===a?"bg-blue-600 text-white":"bg-gray-100 text-gray-700 hover:bg-gray-200"}`,children:["Last ",a]},a))})]}),L&&e.jsx("div",{className:"mb-4 p-3 bg-red-50 border border-red-200 rounded-lg",children:e.jsx("p",{className:"text-red-600 text-sm",children:L})}),t&&e.jsxs("div",{className:"space-y-6 mt-6",children:[e.jsxs("div",{className:"border-l-4 border-blue-500 pl-4",children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3",children:"Overview Summary"}),e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-4",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-blue-600",children:t.overview.total_bots}),e.jsx("div",{className:"text-sm text-gray-500",children:"Total Bots"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-green-600",children:t.overview.active_bots}),e.jsx("div",{className:"text-sm text-gray-500",children:"Active Bots"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-red-600",children:t.overview.errors}),e.jsx("div",{className:"text-sm text-gray-500",children:"Errors"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-yellow-600",children:t.overview.warnings}),e.jsx("div",{className:"text-sm text-gray-500",children:"Warnings"})]})]}),e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-3 gap-4 mt-4",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-lg font-semibold text-gray-700",children:t.overview.total_logs}),e.jsx("div",{className:"text-xs text-gray-500",children:"Total Logs"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-lg font-semibold text-green-600",children:t.overview.successes}),e.jsx("div",{className:"text-xs text-gray-500",children:"Successes"})]}),e.jsx("div",{children:e.jsxs("div",{className:"text-xs text-gray-500",children:["Period: ",new Date(t.period.start).toLocaleDateString()," - ",new Date(t.period.end).toLocaleDateString()]})})]})]}),e.jsxs("div",{children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3",children:"Performance Summary"}),e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-4",children:[e.jsxs("div",{className:"bg-gray-50 p-3 rounded-lg",children:[e.jsx("div",{className:"text-lg font-semibold text-gray-700",children:t.performance_summary.total_trades}),e.jsx("div",{className:"text-xs text-gray-500",children:"Total Trades"})]}),e.jsxs("div",{className:`p-3 rounded-lg ${(((l=t.performance_summary)==null?void 0:l.total_pnl)||0)>=0?"bg-green-50":"bg-red-50"}`,children:[e.jsxs("div",{className:`text-lg font-semibold ${(((g=t.performance_summary)==null?void 0:g.total_pnl)||0)>=0?"text-green-600":"text-red-600"}`,children:["$",(((r=t.performance_summary)==null?void 0:r.total_pnl)||0).toFixed(2)]}),e.jsx("div",{className:"text-xs text-gray-500",children:"Total P&L"})]}),e.jsxs("div",{className:"bg-gray-50 p-3 rounded-lg",children:[e.jsxs("div",{className:"text-lg font-semibold text-gray-700",children:[t.performance_summary.win_rate.toFixed(2),"%"]}),e.jsx("div",{className:"text-xs text-gray-500",children:"Win Rate"})]}),e.jsxs("div",{className:"bg-green-50 p-3 rounded-lg",children:[e.jsx("div",{className:"text-lg font-semibold text-green-600",children:t.performance_summary.profitable_bots}),e.jsx("div",{className:"text-xs text-gray-500",children:"Profitable Bots"})]})]})]}),e.jsxs("div",{children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3",children:"Bot Activity Details"}),e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-gray-200",children:[e.jsx("th",{className:"text-left py-2 px-3",children:"Bot Name"}),e.jsx("th",{className:"text-left py-2 px-3",children:"Status"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Total Logs"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Errors"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Warnings"}),e.jsx("th",{className:"text-right py-2 px-3",children:"Successes"}),e.jsx("th",{className:"text-left py-2 px-3",children:"Last Activity"})]})}),e.jsx("tbody",{children:t.bot_activity.map((a,o)=>e.jsxs("tr",{className:"border-b border-gray-100 hover:bg-gray-50",children:[e.jsx("td",{className:"py-2 px-3 font-medium",children:a.bot_name}),e.jsx("td",{className:"py-2 px-3",children:e.jsx("span",{className:`px-2 py-1 rounded-full text-xs ${a.status==="running"?"bg-green-100 text-green-800":a.status==="paused"?"bg-yellow-100 text-yellow-800":"bg-gray-100 text-gray-800"}`,children:a.status})}),e.jsx("td",{className:"py-2 px-3 text-right",children:a.total_logs}),e.jsx("td",{className:"py-2 px-3 text-right text-red-600",children:a.errors}),e.jsx("td",{className:"py-2 px-3 text-right text-yellow-600",children:a.warnings}),e.jsx("td",{className:"py-2 px-3 text-right text-green-600",children:a.successes}),e.jsx("td",{className:"py-2 px-3 text-gray-600 text-xs",children:a.last_activity?new Date(a.last_activity).toLocaleString():"N/A"})]},o))})]})})]}),t.errors_summary.length>0&&e.jsxs("div",{children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3 text-red-600",children:"Errors Summary"}),e.jsx("div",{className:"space-y-2",children:t.errors_summary.map((a,o)=>e.jsxs("div",{className:"bg-red-50 border border-red-200 rounded-lg p-3",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("span",{className:"font-medium text-gray-900",children:a.bot_name}),e.jsxs("span",{className:"text-red-600 font-semibold",children:[a.error_count," error(s)"]})]}),e.jsxs("div",{className:"text-xs text-gray-600 mb-1",children:["Last Error: ",new Date(a.last_error).toLocaleString()]}),e.jsxs("div",{className:"text-xs text-gray-700",children:[e.jsx("strong",{children:"Common Errors:"})," ",a.common_errors.join(", ")]})]},o))})]})]})]})}function Z(t){var n;return`
<!DOCTYPE html>
<html>
<head>
  <title>Activity Report - ${new Date().toISOString().split("T")[0]}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #333;
    }
    h1 {
      color: #2563eb;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
    }
    h2 {
      color: #1f2937;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
    }
    .stat-box {
      display: inline-block;
      padding: 15px;
      margin: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      min-width: 150px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .error-box {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 10px;
      margin: 10px 0;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Bot Activity Report</h1>
  <p><strong>Generated:</strong> ${new Date(t.generated_at).toLocaleString()}</p>
  <p><strong>Period:</strong> ${new Date(t.period.start).toLocaleDateString()} - ${new Date(t.period.end).toLocaleDateString()}</p>
  
  <h2>Overview Summary</h2>
  <div>
    <div class="stat-box">
      <div class="stat-value">${t.overview.total_bots}</div>
      <div class="stat-label">Total Bots</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${t.overview.active_bots}</div>
      <div class="stat-label">Active Bots</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${t.overview.total_logs}</div>
      <div class="stat-label">Total Logs</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color: #ef4444;">${t.overview.errors}</div>
      <div class="stat-label">Errors</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color: #f59e0b;">${t.overview.warnings}</div>
      <div class="stat-label">Warnings</div>
    </div>
  </div>
  
  <h2>Performance Summary</h2>
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    <tr>
      <td>Total Trades</td>
      <td>${t.performance_summary.total_trades}</td>
    </tr>
    <tr>
      <td>Total P&L</td>
      <td>$${(((n=t.performance_summary)==null?void 0:n.total_pnl)||0).toFixed(2)}</td>
    </tr>
    <tr>
      <td>Win Rate</td>
      <td>${t.performance_summary.win_rate.toFixed(2)}%</td>
    </tr>
    <tr>
      <td>Profitable Bots</td>
      <td>${t.performance_summary.profitable_bots}</td>
    </tr>
  </table>
  
  <h2>Bot Activity Details</h2>
  <table>
    <tr>
      <th>Bot Name</th>
      <th>Status</th>
      <th>Total Logs</th>
      <th>Errors</th>
      <th>Warnings</th>
      <th>Successes</th>
      <th>Last Activity</th>
    </tr>
    ${t.bot_activity.map(h=>`
    <tr>
      <td>${h.bot_name}</td>
      <td>${h.status}</td>
      <td>${h.total_logs}</td>
      <td>${h.errors}</td>
      <td>${h.warnings}</td>
      <td>${h.successes}</td>
      <td>${h.last_activity?new Date(h.last_activity).toLocaleString():"N/A"}</td>
    </tr>
    `).join("")}
  </table>
  
  ${t.errors_summary.length>0?`
  <h2>Errors Summary</h2>
  ${t.errors_summary.map(h=>`
  <div class="error-box">
    <strong>${h.bot_name}</strong> - ${h.error_count} error(s)<br>
    Last Error: ${new Date(h.last_error).toLocaleString()}<br>
    Common Errors: ${h.common_errors.join(", ")}
  </div>
  `).join("")}
  `:""}
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  <\/script>
</body>
</html>
  `}function ee(){const[t,n]=$.useState(null),[h,S]=$.useState(!1),[L,y]=$.useState(null),[T,p]=$.useState("7d"),j=async()=>{S(!0),y(null);try{const{data:{user:l}}=await F.auth.getUser();if(!l)throw new Error("Not authenticated");let g;const r=new Date;switch(T){case"7d":g=new Date(Date.now()-7*24*60*60*1e3);break;case"30d":g=new Date(Date.now()-30*24*60*60*1e3);break;case"60d":g=new Date(Date.now()-60*24*60*60*1e3);break;case"90d":g=new Date(Date.now()-90*24*60*60*1e3);break;default:g=new Date(Date.now()-7*24*60*60*1e3)}const{data:a}=await F.from("trading_bots").select("id, name").eq("user_id",l.id),o=(a==null?void 0:a.map(d=>d.id))||[],w=new Map((a==null?void 0:a.map(d=>[d.id,d.name]))||[]),{data:b}=await F.from("bot_activity_logs").select("*").in("bot_id",o).in("level",["error","warning"]).gte("timestamp",g.toISOString()).lte("timestamp",r.toISOString()).order("timestamp",{ascending:!1}),f=b||[],s=f.filter(d=>d.level==="error"),_=f.filter(d=>d.level==="warning"),c=new Map;f.forEach(d=>{c.has(d.bot_id)||c.set(d.bot_id,[]),c.get(d.bot_id).push(d)});const m=Array.from(c.entries()).map(([d,N])=>{var U;const C=new Map;return N.forEach(D=>{const O=D.message||"Unknown error";C.has(O)||C.set(O,{count:0,first:D.timestamp,last:D.timestamp});const I=C.get(O);I.count++,D.timestamp<I.first&&(I.first=D.timestamp),D.timestamp>I.last&&(I.last=D.timestamp)}),{bot_id:d,bot_name:w.get(d)||"Unknown Bot",error_count:N.length,last_error:((U=N[0])==null?void 0:U.timestamp)||"",error_types:Array.from(C.entries()).map(([D,O])=>({message:D,count:O.count,first_occurrence:O.first,last_occurrence:O.last})).sort((D,O)=>O.count-D.count)}}).sort((d,N)=>N.error_count-d.error_count),k=new Map;f.forEach(d=>{const N=d.message||"Unknown error";k.has(N)||k.set(N,{count:0,bots:new Set,first:d.timestamp,last:d.timestamp});const C=k.get(N);C.count++,C.bots.add(d.bot_id),d.timestamp<C.first&&(C.first=d.timestamp),d.timestamp>C.last&&(C.last=d.timestamp)});const B=Array.from(k.entries()).map(([d,N])=>{const C=d.toLowerCase().includes("failed")||d.toLowerCase().includes("error")||d.toLowerCase().includes("exception")||d.toLowerCase().includes("timeout");return{error_message:d,count:N.count,affected_bots:N.bots.size,first_occurrence:N.first,last_occurrence:N.last,severity:C?"critical":"warning"}}).sort((d,N)=>N.count-d.count),P=f.slice(0,50).map(d=>({timestamp:d.timestamp,bot_id:d.bot_id,bot_name:w.get(d.bot_id)||"Unknown Bot",level:d.level,category:d.category||"unknown",message:d.message,details:d.details})),x=s.filter(d=>{const N=(d.message||"").toLowerCase();return N.includes("failed")||N.includes("exception")||N.includes("timeout")||N.includes("critical")}).length,v={generated_at:new Date().toISOString(),period:{start:g.toISOString(),end:r.toISOString()},summary:{total_errors:s.length,unique_errors:B.length,bots_with_errors:m.length,critical_errors:x,warnings:_.length},errors_by_bot:m,errors_by_type:B,recent_errors:P};n(v)}catch(l){y(l.message||"Failed to generate error report"),console.error("Error report generation error:",l)}finally{S(!1)}},i=()=>{if(!t)return;const l=te(t),g=window.open("","_blank");g&&(g.document.write(l),g.document.close(),g.focus(),setTimeout(()=>{g.print()},250))},A=()=>{if(!t)return;let l=`Errors Report
`;l+=`Generated: ${new Date(t.generated_at).toLocaleString()}
`,l+=`Period: ${new Date(t.period.start).toLocaleDateString()} - ${new Date(t.period.end).toLocaleDateString()}

`,l+=`SUMMARY
`,l+=`Total Errors,${t.summary.total_errors}
`,l+=`Unique Error Types,${t.summary.unique_errors}
`,l+=`Bots with Errors,${t.summary.bots_with_errors}
`,l+=`Critical Errors,${t.summary.critical_errors}
`,l+=`Warnings,${t.summary.warnings}

`,l+=`ERRORS BY TYPE
`,l+=`Error Message,Count,Affected Bots,Severity,First Occurrence,Last Occurrence
`,t.errors_by_type.forEach(o=>{l+=`"${o.error_message.replace(/"/g,'""')}",${o.count},${o.affected_bots},${o.severity},${new Date(o.first_occurrence).toLocaleString()},${new Date(o.last_occurrence).toLocaleString()}
`}),l+=`
`,l+=`ERRORS BY BOT
`,l+=`Bot Name,Total Errors,Last Error
`,t.errors_by_bot.forEach(o=>{l+=`${o.bot_name},${o.error_count},${new Date(o.last_error).toLocaleString()}
`}),l+=`
`,l+=`RECENT ERRORS (Last 50)
`,l+=`Timestamp,Bot Name,Level,Category,Message
`,t.recent_errors.forEach(o=>{l+=`${new Date(o.timestamp).toLocaleString()},${o.bot_name},${o.level},${o.category},"${(o.message||"").replace(/"/g,'""')}"
`});const g=new Blob([l],{type:"text/csv;charset=utf-8;"}),r=URL.createObjectURL(g),a=document.createElement("a");a.href=r,a.download=`errors-report-${new Date().toISOString().split("T")[0]}.csv`,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(r)},u=()=>{if(!t)return;const l=JSON.stringify(t,null,2),g=new Blob([l],{type:"application/json"}),r=URL.createObjectURL(g),a=document.createElement("a");a.href=r,a.download=`errors-report-${new Date().toISOString().split("T")[0]}.json`,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(r)};return e.jsxs(R,{className:"p-6",children:[e.jsx("div",{className:"flex items-center justify-between mb-4",children:e.jsxs("div",{children:[e.jsxs("h3",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[e.jsx("i",{className:"ri-error-warning-line mr-2 text-red-600"}),"Errors Report Generator"]}),e.jsx("p",{className:"text-sm text-gray-500 mt-1",children:"Generate detailed reports of bot errors and warnings"})]})}),e.jsxs("div",{className:"mb-4",children:[e.jsx("label",{className:"block text-sm font-medium text-gray-700 mb-2",children:"Select Period"}),e.jsx("div",{className:"flex space-x-2",children:["7d","30d","60d","90d"].map(l=>e.jsx("button",{onClick:()=>p(l),className:`px-4 py-2 rounded-lg text-sm font-medium ${T===l?"bg-red-600 text-white":"bg-gray-100 text-gray-700 hover:bg-gray-200"}`,children:l==="7d"?"7 Days":l==="30d"?"30 Days":l==="60d"?"60 Days":"90 Days"},l))})]}),e.jsx("div",{className:"mb-4",children:e.jsx(E,{variant:"primary",onClick:j,disabled:h,children:h?e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"ri-loader-4-line animate-spin mr-2"}),"Generating Report..."]}):e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"ri-file-list-3-line mr-2"}),"Generate Errors Report"]})})}),L&&e.jsxs("div",{className:"mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm",children:[e.jsx("i",{className:"ri-error-warning-line mr-2"}),L]}),t&&e.jsxs("div",{className:"space-y-6 mt-6",children:[e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-5 gap-4",children:[e.jsxs("div",{className:"bg-red-50 p-4 rounded-lg text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-red-600",children:t.summary.total_errors}),e.jsx("div",{className:"text-xs text-gray-600 mt-1",children:"Total Errors"})]}),e.jsxs("div",{className:"bg-orange-50 p-4 rounded-lg text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-orange-600",children:t.summary.critical_errors}),e.jsx("div",{className:"text-xs text-gray-600 mt-1",children:"Critical"})]}),e.jsxs("div",{className:"bg-yellow-50 p-4 rounded-lg text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-yellow-600",children:t.summary.warnings}),e.jsx("div",{className:"text-xs text-gray-600 mt-1",children:"Warnings"})]}),e.jsxs("div",{className:"bg-blue-50 p-4 rounded-lg text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-blue-600",children:t.summary.unique_errors}),e.jsx("div",{className:"text-xs text-gray-600 mt-1",children:"Unique Types"})]}),e.jsxs("div",{className:"bg-purple-50 p-4 rounded-lg text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-purple-600",children:t.summary.bots_with_errors}),e.jsx("div",{className:"text-xs text-gray-600 mt-1",children:"Affected Bots"})]})]}),e.jsxs("div",{className:"flex space-x-2",children:[e.jsxs(E,{variant:"secondary",onClick:A,children:[e.jsx("i",{className:"ri-download-line mr-2"}),"Download CSV"]}),e.jsxs(E,{variant:"secondary",onClick:i,children:[e.jsx("i",{className:"ri-file-pdf-line mr-2"}),"Download PDF"]}),e.jsxs(E,{variant:"secondary",onClick:u,children:[e.jsx("i",{className:"ri-file-code-line mr-2"}),"Download JSON"]})]}),t.errors_by_type.length>0&&e.jsxs("div",{children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3",children:"Errors by Type"}),e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"min-w-full divide-y divide-gray-200",children:[e.jsx("thead",{className:"bg-gray-50",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase",children:"Error Message"}),e.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase",children:"Count"}),e.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase",children:"Affected Bots"}),e.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase",children:"Severity"}),e.jsx("th",{className:"px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase",children:"Last Occurrence"})]})}),e.jsx("tbody",{className:"bg-white divide-y divide-gray-200",children:t.errors_by_type.slice(0,20).map((l,g)=>e.jsxs("tr",{className:g%2===0?"bg-white":"bg-gray-50",children:[e.jsx("td",{className:"px-4 py-3 text-sm text-gray-900 max-w-md truncate",title:l.error_message,children:l.error_message}),e.jsx("td",{className:"px-4 py-3 text-sm text-gray-700",children:l.count}),e.jsx("td",{className:"px-4 py-3 text-sm text-gray-700",children:l.affected_bots}),e.jsx("td",{className:"px-4 py-3 text-sm",children:e.jsx("span",{className:`px-2 py-1 rounded-full text-xs font-medium ${l.severity==="critical"?"bg-red-100 text-red-800":"bg-yellow-100 text-yellow-800"}`,children:l.severity})}),e.jsx("td",{className:"px-4 py-3 text-sm text-gray-500",children:new Date(l.last_occurrence).toLocaleString()})]},g))})]})})]}),t.errors_by_bot.length>0&&e.jsxs("div",{children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3",children:"Errors by Bot"}),e.jsx("div",{className:"space-y-2",children:t.errors_by_bot.map((l,g)=>e.jsxs("div",{className:"bg-gray-50 p-4 rounded-lg",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("span",{className:"font-medium text-gray-900",children:l.bot_name}),e.jsxs("span",{className:"text-sm text-gray-600",children:[l.error_count," error",l.error_count!==1?"s":""]})]}),e.jsxs("div",{className:"text-xs text-gray-500 mb-2",children:["Last error: ",new Date(l.last_error).toLocaleString()]}),e.jsxs("div",{className:"space-y-1",children:[l.error_types.slice(0,3).map((r,a)=>e.jsxs("div",{className:"text-xs text-gray-600 pl-2 border-l-2 border-red-300",children:[e.jsxs("span",{className:"font-medium",children:[r.count,"x"]})," - ",r.message]},a)),l.error_types.length>3&&e.jsxs("div",{className:"text-xs text-gray-400 pl-2",children:["+",l.error_types.length-3," more error type",l.error_types.length-3!==1?"s":""]})]})]},g))})]}),t.recent_errors.length>0&&e.jsxs("div",{children:[e.jsx("h4",{className:"text-md font-semibold text-gray-900 mb-3",children:"Recent Errors (Last 50)"}),e.jsx("div",{className:"space-y-2 max-h-96 overflow-y-auto",children:t.recent_errors.map((l,g)=>e.jsx("div",{className:"bg-gray-50 p-3 rounded-lg text-sm",children:e.jsxs("div",{className:"flex items-start justify-between",children:[e.jsxs("div",{className:"flex-1",children:[e.jsxs("div",{className:"flex items-center space-x-2 mb-1",children:[e.jsx("span",{className:"font-medium text-gray-900",children:l.bot_name}),e.jsx("span",{className:`px-2 py-0.5 rounded text-xs ${l.level==="error"?"bg-red-100 text-red-800":"bg-yellow-100 text-yellow-800"}`,children:l.level}),e.jsx("span",{className:"text-xs text-gray-500",children:l.category})]}),e.jsx("div",{className:"text-gray-700",children:l.message})]}),e.jsx("div",{className:"text-xs text-gray-500 ml-4",children:new Date(l.timestamp).toLocaleString()})]})},g))})]})]})]})}function te(t){return`
<!DOCTYPE html>
<html>
<head>
  <title>Errors Report - ${new Date().toISOString().split("T")[0]}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #333;
    }
    h1 {
      color: #dc2626;
      border-bottom: 2px solid #dc2626;
      padding-bottom: 10px;
    }
    h2 {
      color: #1f2937;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
    }
    .stat-box {
      display: inline-block;
      padding: 15px;
      margin: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      min-width: 150px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #dc2626;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .error-box {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 10px;
      margin: 10px 0;
    }
    .critical {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .warning {
      background-color: #fef3c7;
      color: #92400e;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Errors Report</h1>
  <p><strong>Generated:</strong> ${new Date(t.generated_at).toLocaleString()}</p>
  <p><strong>Period:</strong> ${new Date(t.period.start).toLocaleDateString()} - ${new Date(t.period.end).toLocaleDateString()}</p>
  
  <h2>Summary</h2>
  <div>
    <div class="stat-box">
      <div class="stat-value">${t.summary.total_errors}</div>
      <div class="stat-label">Total Errors</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${t.summary.critical_errors}</div>
      <div class="stat-label">Critical Errors</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${t.summary.warnings}</div>
      <div class="stat-label">Warnings</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${t.summary.unique_errors}</div>
      <div class="stat-label">Unique Error Types</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${t.summary.bots_with_errors}</div>
      <div class="stat-label">Bots with Errors</div>
    </div>
  </div>
  
  <h2>Errors by Type</h2>
  <table>
    <tr>
      <th>Error Message</th>
      <th>Count</th>
      <th>Affected Bots</th>
      <th>Severity</th>
      <th>Last Occurrence</th>
    </tr>
    ${t.errors_by_type.map(n=>`
    <tr class="${n.severity}">
      <td>${n.error_message}</td>
      <td>${n.count}</td>
      <td>${n.affected_bots}</td>
      <td>${n.severity}</td>
      <td>${new Date(n.last_occurrence).toLocaleString()}</td>
    </tr>
    `).join("")}
  </table>
  
  <h2>Errors by Bot</h2>
  <table>
    <tr>
      <th>Bot Name</th>
      <th>Total Errors</th>
      <th>Last Error</th>
    </tr>
    ${t.errors_by_bot.map(n=>`
    <tr>
      <td>${n.bot_name}</td>
      <td>${n.error_count}</td>
      <td>${new Date(n.last_error).toLocaleString()}</td>
    </tr>
    `).join("")}
  </table>
  
  <h2>Recent Errors</h2>
  <table>
    <tr>
      <th>Timestamp</th>
      <th>Bot Name</th>
      <th>Level</th>
      <th>Category</th>
      <th>Message</th>
    </tr>
    ${t.recent_errors.map(n=>`
    <tr>
      <td>${new Date(n.timestamp).toLocaleString()}</td>
      <td>${n.bot_name}</td>
      <td>${n.level}</td>
      <td>${n.category}</td>
      <td>${n.message}</td>
    </tr>
    `).join("")}
  </table>
</body>
</html>
  `}function ce(){const{bots:t}=Y(),{activities:n,loading:h,addLog:S,clearBotLogs:L,simulateBotActivity:y}=V(t),[T,p]=$.useState("all"),[j,i]=$.useState(!1),A=$.useRef(null);$.useEffect(()=>{const r=a=>{A.current&&!A.current.contains(a.target)&&i(!1)};return j&&document.addEventListener("mousedown",r),()=>{document.removeEventListener("mousedown",r)}},[j]);const u=n.filter(r=>T==="all"||r.status===T),l=async r=>{await S(r,{level:"info",category:"system",message:"Manual test log added",details:{timestamp:new Date().toISOString(),source:"manual"}})},g=async r=>{await S(r,{level:"error",category:"error",message:"Simulated error for testing",details:{error:"Connection timeout",retry:!0}})};return e.jsxs("div",{className:"min-h-screen bg-gray-50",children:[e.jsx(M,{title:"Bot Activity Logs",subtitle:"Monitor bot operations and debug issues",rightAction:e.jsx("div",{className:"flex space-x-2",children:e.jsxs(E,{variant:"primary",size:"sm",onClick:()=>window.location.reload(),children:[e.jsx("i",{className:"ri-refresh-line mr-1"}),"Refresh"]})})}),e.jsxs("div",{className:"pt-20 pb-20 px-4 space-y-6",children:[e.jsxs(R,{className:"p-6",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsxs("h3",{className:"text-lg font-semibold text-gray-900 flex items-center",children:[e.jsx("i",{className:"ri-pulse-line mr-2 text-blue-600 animate-pulse"}),"Recent Activity"]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:"text-xs text-gray-500",children:"Updates every 10s"}),e.jsxs("div",{className:"relative",ref:A,children:[e.jsxs(E,{variant:"secondary",size:"sm",onClick:()=>i(!j),children:[e.jsx("i",{className:"ri-download-line mr-1"}),"Download",e.jsx("i",{className:`ri-arrow-${j?"up":"down"}-s-line ml-1`})]}),j&&e.jsxs("div",{className:"absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10",children:[e.jsxs("button",{className:"w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center",onClick:()=>{i(!1);const r=[],a=new Date;r.push("Recent Activity Report"),r.push(`Generated: ${a.toLocaleString()}`),r.push(`Generated (ISO): ${a.toISOString()}`),r.push(""),r.push("SUMMARY"),r.push(`Total Bots,${n.length}`),r.push(`Running,${n.filter(c=>c.status==="running").length}`),r.push(`Paused,${n.filter(c=>c.status==="paused").length}`),r.push(`Stopped,${n.filter(c=>c.status==="stopped").length}`),r.push(`Executing,${n.filter(c=>c.executionState==="executing").length}`),r.push(`Analyzing,${n.filter(c=>c.executionState==="analyzing").length}`),r.push(`Waiting,${n.filter(c=>c.executionState==="waiting").length}`),r.push(`Errors,${n.filter(c=>c.executionState==="error").length}`),r.push(`Total Errors,${n.reduce((c,m)=>c+m.errorCount,0)}`),r.push(`Total Success,${n.reduce((c,m)=>c+m.successCount,0)}`),r.push(""),r.push("BOT ACTIVITY DETAILS"),r.push("Bot ID,Bot Name,Status,Execution State,Current Action,Waiting For,Last Activity,Last Activity (Readable),Last Execution Time,Last Execution Time (Readable),Error Count,Success Count,Recent Logs Count");const o=c=>{if(!c||c==="N/A")return"N/A";try{return new Date(c).toLocaleString()}catch{return c}};n.forEach(c=>{r.push([c.botId,`"${c.botName}"`,c.status,c.executionState||"N/A",`"${(c.currentAction||"").replace(/"/g,'""')}"`,`"${(c.waitingFor||"").replace(/"/g,'""')}"`,c.lastActivity||"N/A",o(c.lastActivity),c.lastExecutionTime||"N/A",o(c.lastExecutionTime),c.errorCount,c.successCount,c.logs.length].join(","))});const w=n.filter(c=>c.errorCount>0);w.length>0&&(r.push(""),r.push("BOTS WITH ERRORS"),r.push("Bot Name,Error Count,Last Activity,Status"),w.forEach(c=>{r.push([`"${c.botName}"`,c.errorCount,c.lastActivity||"N/A",c.status].join(","))}));const b=r.join(`
`),f=new Blob([b],{type:"text/csv;charset=utf-8;"}),s=URL.createObjectURL(f),_=document.createElement("a");_.href=s,_.download=`recent-activity-${new Date().toISOString().split("T")[0]}.csv`,document.body.appendChild(_),_.click(),document.body.removeChild(_),URL.revokeObjectURL(s)},children:[e.jsx("i",{className:"ri-file-excel-line mr-2"}),"Download CSV"]}),e.jsxs("button",{className:"w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center",onClick:()=>{i(!1);const r=new Date,a={report_title:"Recent Activity Report",generated_at:r.toISOString(),generated_at_readable:r.toLocaleString(),metadata:{total_bots:n.length,report_version:"1.1",export_format:"JSON"},summary:{total_bots:n.length,by_status:{running:n.filter(s=>s.status==="running").length,paused:n.filter(s=>s.status==="paused").length,stopped:n.filter(s=>s.status==="stopped").length},by_execution_state:{executing:n.filter(s=>s.executionState==="executing").length,analyzing:n.filter(s=>s.executionState==="analyzing").length,waiting:n.filter(s=>s.executionState==="waiting").length,idle:n.filter(s=>s.executionState==="idle").length,error:n.filter(s=>s.executionState==="error").length},totals:{total_errors:n.reduce((s,_)=>s+_.errorCount,0),total_success:n.reduce((s,_)=>s+_.successCount,0),total_logs:n.reduce((s,_)=>s+_.logs.length,0)}},activities_by_state:{executing:n.filter(s=>s.executionState==="executing").map(s=>({bot_id:s.botId,bot_name:s.botName,status:s.status,current_action:s.currentAction,waiting_for:s.waitingFor||null,last_activity:s.lastActivity,last_activity_readable:s.lastActivity?new Date(s.lastActivity).toLocaleString():null,last_execution_time:s.lastExecutionTime,last_execution_time_readable:s.lastExecutionTime?new Date(s.lastExecutionTime).toLocaleString():null,error_count:s.errorCount,success_count:s.successCount,recent_logs_count:s.logs.length})),analyzing:n.filter(s=>s.executionState==="analyzing").map(s=>({bot_id:s.botId,bot_name:s.botName,status:s.status,current_action:s.currentAction,waiting_for:s.waitingFor||null,last_activity:s.lastActivity,last_activity_readable:s.lastActivity?new Date(s.lastActivity).toLocaleString():null,last_execution_time:s.lastExecutionTime,last_execution_time_readable:s.lastExecutionTime?new Date(s.lastExecutionTime).toLocaleString():null,error_count:s.errorCount,success_count:s.successCount,recent_logs_count:s.logs.length})),waiting:n.filter(s=>s.executionState==="waiting").map(s=>({bot_id:s.botId,bot_name:s.botName,status:s.status,current_action:s.currentAction,waiting_for:s.waitingFor||null,last_activity:s.lastActivity,last_activity_readable:s.lastActivity?new Date(s.lastActivity).toLocaleString():null,last_execution_time:s.lastExecutionTime,last_execution_time_readable:s.lastExecutionTime?new Date(s.lastExecutionTime).toLocaleString():null,error_count:s.errorCount,success_count:s.successCount,recent_logs_count:s.logs.length})),idle:n.filter(s=>s.executionState==="idle").map(s=>({bot_id:s.botId,bot_name:s.botName,status:s.status,current_action:s.currentAction,waiting_for:s.waitingFor||null,last_activity:s.lastActivity,last_activity_readable:s.lastActivity?new Date(s.lastActivity).toLocaleString():null,last_execution_time:s.lastExecutionTime,last_execution_time_readable:s.lastExecutionTime?new Date(s.lastExecutionTime).toLocaleString():null,error_count:s.errorCount,success_count:s.successCount,recent_logs_count:s.logs.length})),errors:n.filter(s=>s.executionState==="error").map(s=>({bot_id:s.botId,bot_name:s.botName,status:s.status,current_action:s.currentAction,waiting_for:s.waitingFor||null,last_activity:s.lastActivity,last_activity_readable:s.lastActivity?new Date(s.lastActivity).toLocaleString():null,last_execution_time:s.lastExecutionTime,last_execution_time_readable:s.lastExecutionTime?new Date(s.lastExecutionTime).toLocaleString():null,error_count:s.errorCount,success_count:s.successCount,recent_logs_count:s.logs.length}))},all_activities:n.map(s=>({bot_id:s.botId,bot_name:s.botName,status:s.status,execution_state:s.executionState,current_action:s.currentAction,waiting_for:s.waitingFor||null,last_activity:s.lastActivity,last_activity_readable:s.lastActivity?new Date(s.lastActivity).toLocaleString():null,last_execution_time:s.lastExecutionTime,last_execution_time_readable:s.lastExecutionTime?new Date(s.lastExecutionTime).toLocaleString():null,error_count:s.errorCount,success_count:s.successCount,recent_logs_count:s.logs.length})),bots_with_errors:n.filter(s=>s.errorCount>0).map(s=>({bot_id:s.botId,bot_name:s.botName,status:s.status,error_count:s.errorCount,last_activity:s.lastActivity,last_activity_readable:s.lastActivity?new Date(s.lastActivity).toLocaleString():null,current_action:s.currentAction}))},o=JSON.stringify(a,null,2),w=new Blob([o],{type:"application/json"}),b=URL.createObjectURL(w),f=document.createElement("a");f.href=b,f.download=`recent-activity-${new Date().toISOString().split("T")[0]}.json`,document.body.appendChild(f),f.click(),document.body.removeChild(f),URL.revokeObjectURL(b)},children:[e.jsx("i",{className:"ri-file-code-line mr-2"}),"Download JSON"]})]})]})]})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",children:[n.filter(r=>r.executionState==="executing").length>0&&e.jsxs("div",{className:"p-4 bg-purple-50 border-2 border-purple-200 rounded-lg",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("span",{className:"text-sm font-medium text-purple-800",children:"Executing"}),e.jsx("i",{className:"ri-loader-4-line animate-spin text-purple-600"})]}),e.jsxs("div",{className:"space-y-2",children:[n.filter(r=>r.executionState==="executing").slice(0,3).map(r=>e.jsxs("div",{className:"text-sm",children:[e.jsx("span",{className:"font-medium text-purple-900",children:r.botName}),e.jsxs("span",{className:"text-purple-700 ml-2",children:["• ",r.currentAction]})]},r.botId)),n.filter(r=>r.executionState==="executing").length>3&&e.jsxs("div",{className:"text-xs text-purple-600",children:["+",n.filter(r=>r.executionState==="executing").length-3," more"]})]})]}),n.filter(r=>r.executionState==="analyzing").length>0&&e.jsxs("div",{className:"p-4 bg-blue-50 border-2 border-blue-200 rounded-lg",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("span",{className:"text-sm font-medium text-blue-800",children:"Analyzing Market"}),e.jsx("i",{className:"ri-bar-chart-line text-blue-600"})]}),e.jsxs("div",{className:"space-y-2",children:[n.filter(r=>r.executionState==="analyzing").slice(0,3).map(r=>e.jsxs("div",{className:"text-sm",children:[e.jsx("span",{className:"font-medium text-blue-900",children:r.botName}),e.jsxs("span",{className:"text-blue-700 ml-2",children:["• ",r.currentAction]})]},r.botId)),n.filter(r=>r.executionState==="analyzing").length>3&&e.jsxs("div",{className:"text-xs text-blue-600",children:["+",n.filter(r=>r.executionState==="analyzing").length-3," more"]})]})]}),n.filter(r=>r.executionState==="waiting").length>0&&e.jsxs("div",{className:"p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("span",{className:"text-sm font-medium text-yellow-800",children:"Waiting"}),e.jsx("i",{className:"ri-time-line text-yellow-600"})]}),e.jsxs("div",{className:"space-y-2",children:[n.filter(r=>r.executionState==="waiting").slice(0,3).map(r=>e.jsxs("div",{className:"text-sm",children:[e.jsx("span",{className:"font-medium text-yellow-900",children:r.botName}),e.jsx("span",{className:"text-yellow-700 ml-2",children:r.waitingFor?`• Waiting: ${r.waitingFor}`:`• ${r.currentAction}`})]},r.botId)),n.filter(r=>r.executionState==="waiting").length>3&&e.jsxs("div",{className:"text-xs text-yellow-600",children:["+",n.filter(r=>r.executionState==="waiting").length-3," more"]})]})]})]}),e.jsxs("div",{className:"mt-4 pt-4 border-t border-gray-200 grid grid-cols-4 gap-4 text-center",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-purple-600",children:n.filter(r=>r.executionState==="executing").length}),e.jsx("div",{className:"text-xs text-gray-500",children:"Executing"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-blue-600",children:n.filter(r=>r.executionState==="analyzing").length}),e.jsx("div",{className:"text-xs text-gray-500",children:"Analyzing"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-yellow-600",children:n.filter(r=>r.executionState==="waiting").length}),e.jsx("div",{className:"text-xs text-gray-500",children:"Waiting"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-red-600",children:n.filter(r=>r.executionState==="error").length}),e.jsx("div",{className:"text-xs text-gray-500",children:"Errors"})]})]})]}),e.jsx("div",{className:"flex space-x-2 overflow-x-auto",children:["all","running","paused","stopped"].map(r=>e.jsx("button",{onClick:()=>p(r),className:`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${T===r?"bg-blue-600 text-white":"bg-white text-gray-600 border border-gray-200"}`,children:r.charAt(0).toUpperCase()+r.slice(1)},r))}),e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4",children:[e.jsxs(R,{className:"p-4 text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-blue-600",children:n.length}),e.jsx("div",{className:"text-sm text-gray-500",children:"Total Bots"})]}),e.jsxs(R,{className:"p-4 text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-green-600",children:n.filter(r=>r.status==="running").length}),e.jsx("div",{className:"text-sm text-gray-500",children:"Active"})]}),e.jsxs(R,{className:"p-4 text-center",children:[e.jsxs("div",{className:`text-2xl font-bold ${t.reduce((r,a)=>r+(a.pnl||0),0)>=0?"text-green-600":"text-red-600"}`,children:["$",t.reduce((r,a)=>r+(a.pnl||0),0).toFixed(2)]}),e.jsx("div",{className:"text-sm text-gray-500",children:"Total PnL"})]}),e.jsxs(R,{className:"p-4 text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-gray-900",children:t.reduce((r,a)=>r+(a.totalTrades||0),0)}),e.jsx("div",{className:"text-sm text-gray-500",children:"Total Trades"})]}),e.jsxs(R,{className:"p-4 text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-blue-600",children:(()=>{const r=t.filter(o=>(o.totalTrades||0)>0);return`${(r.length>0?r.reduce((o,w)=>o+(w.winRate||0),0)/r.length:0).toFixed(1)}%`})()}),e.jsx("div",{className:"text-sm text-gray-500",children:"Win Rate"})]}),e.jsxs(R,{className:"p-4 text-center",children:[e.jsxs("div",{className:"text-2xl font-bold text-gray-900",children:[t.reduce((r,a)=>r+(a.winTrades||0),0),"/",t.reduce((r,a)=>r+(a.lossTrades||0),0)]}),e.jsx("div",{className:"text-sm text-gray-500",children:"Win/Loss"})]}),e.jsxs(R,{className:"p-4 text-center",children:[e.jsxs("div",{className:"text-2xl font-bold text-red-600",children:["$",Math.abs(t.reduce((r,a)=>{const o=a.totalFees||a.total_fees||a.fees||0;return r+o},0)).toFixed(2)]}),e.jsx("div",{className:"text-sm text-gray-500",children:"Total Fees"})]}),e.jsxs(R,{className:"p-4 text-center",children:[e.jsx("div",{className:"text-2xl font-bold text-red-600",children:(()=>{let r=0,a=0,o=0;return[...t].sort((b,f)=>new Date(b.createdAt).getTime()-new Date(f.createdAt).getTime()).forEach(b=>{const f=b.pnl||0;o+=f,o>a&&(a=o);const s=a-o;s>r&&(r=s)}),`$${r.toFixed(2)}`})()}),e.jsx("div",{className:"text-sm text-gray-500",children:"Max Drawdown"})]})]}),e.jsx("div",{className:"space-y-4",children:h?e.jsxs("div",{className:"text-center py-12",children:[e.jsx("div",{className:"animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"}),e.jsx("p",{className:"text-gray-600",children:"Loading bot activities..."})]}):u.length===0?e.jsxs("div",{className:"text-center py-12",children:[e.jsx("i",{className:"ri-robot-line text-4xl text-gray-400 mb-4"}),e.jsx("h3",{className:"text-lg font-medium text-gray-900 mb-2",children:"No bots found"}),e.jsx("p",{className:"text-gray-500 mb-4",children:"Create some bots to see their activity logs"})]}):u.map(r=>e.jsx(q,{activity:r,onClearLogs:L,onSimulateActivity:y},r.botId))}),e.jsx(X,{}),e.jsx(ee,{}),e.jsx(K,{}),e.jsxs(R,{className:"p-6",children:[e.jsx("h3",{className:"text-lg font-semibold text-gray-900 mb-4",children:"Debug Tools"}),e.jsxs("div",{className:"grid grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("h4",{className:"font-medium text-gray-700 mb-2",children:"Test Logging"}),e.jsx("p",{className:"text-sm text-gray-500 mb-3",children:"Add test logs to verify the logging system is working"}),e.jsx("div",{className:"space-x-2",children:n.slice(0,3).map(r=>e.jsxs(E,{variant:"secondary",size:"sm",onClick:()=>l(r.botId),children:["Test ",r.botName]},r.botId))})]}),e.jsxs("div",{children:[e.jsx("h4",{className:"font-medium text-gray-700 mb-2",children:"Error Simulation"}),e.jsx("p",{className:"text-sm text-gray-500 mb-3",children:"Simulate errors to test error handling and logging"}),e.jsx("div",{className:"space-x-2",children:n.slice(0,3).map(r=>e.jsxs(E,{variant:"danger",size:"sm",onClick:()=>g(r.botId),children:["Error ",r.botName]},r.botId))})]})]})]})]}),e.jsx(G,{})]})}export{ce as default};
