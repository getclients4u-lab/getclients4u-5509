const state={cfg:null,a:null,i:0,responses:{},lead:{}};
const $=s=>document.querySelector(s);
const show=id=>{["#hero","#quiz","#lead","#results"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden")};
fetch("./diagnostics.json").then(r=>r.json()).then(cfg=>{
 state.cfg=cfg; $("#consentText").textContent=cfg.leadCapture.consentText;
 cfg.assessments.forEach(a=>{
   const d=document.createElement("article");d.className="card";
   d.innerHTML=`<div class="eyebrow">${a.short.toUpperCase()}</div><h3>${a.title}</h3><p>${a.description}</p>`;
   d.onclick=()=>start(a); $("#assessmentCards").appendChild(d);
 });
});
function start(a){state.a=a;state.i=0;state.responses={};show("#quiz");renderQ()}
function renderQ(){
 const q=state.a.questions[state.i];$("#quizEyebrow").textContent=state.a.title;$("#questionText").textContent=q.text;
 $("#counter").textContent=`${state.i+1} of ${state.a.questions.length}`;
 $("#progressBar").style.width=`${(state.i/state.a.questions.length)*100}%`;
 $("#backBtn").disabled=state.i===0;
 const scale=$("#scale");scale.innerHTML="";
 Object.entries(state.cfg.scale.labels).forEach(([v,l])=>{let b=document.createElement("button");b.innerHTML=`${v}<small>${l}</small>`;b.onclick=()=>answer(q.id,Number(v));scale.appendChild(b)});
}
function answer(id,val){state.responses[id]=val;if(++state.i>=state.a.questions.length){show("#lead")}else renderQ()}
$("#backBtn").onclick=()=>{if(state.i>0){state.i--;renderQ()}};
$("#skipLead").onclick=()=>renderResults();
$("#leadForm").onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);state.lead=Object.fromEntries(fd.entries());renderResults();};
function getBand(s){return state.cfg.bands.find(b=>s>=b.min&&s<=b.max)||state.cfg.bands.at(-1)}
const recs={
"Strategy":"Clarify the 12–24 month growth thesis and translate it into three measurable enterprise priorities.",
"Revenue":"Instrument the revenue engine from qualified pipeline through retention and expansion; assign one owner per leakage point.",
"Operations":"Create a single operating view for initiatives, owners, dependencies, blockers, outcomes, and intervention decisions.",
"AI Alignment":"Tie AI investments to quantified revenue, margin, speed, quality, or customer-experience outcomes.",
"Business Value":"Prioritize AI use cases using business value, feasibility, risk, and time-to-impact before selecting tools.",
"Data & Systems":"Assess whether data and systems required for priority AI use cases are accessible, reliable, and integrable.",
"Workflow":"Document the current workflow and baseline metrics before automating or augmenting it with AI.",
"People":"Assign executive and functional owners for AI adoption and provide role-specific enablement.",
"Governance":"Define practical AI policies covering privacy, security, human review, vendor risk, and performance monitoring.",
"Clarity":"Translate strategy into explicit outcomes, definitions of done, and a short list of enterprise priorities.",
"Ownership":"Establish one accountable owner and explicit decision rights for every critical initiative.",
"Cadence":"Redesign operating reviews around decisions, blockers, corrective actions, and closed-loop follow-through.",
"Visibility":"Build a concise executive scorecard combining outcomes, risks, initiative status, and leading indicators.",
"Acquisition":"Measure channel quality by qualified pipeline and economics, then redirect resources toward the best-performing sources.",
"Conversion":"Standardize stage criteria and analyze where qualified opportunities stall or exit the funnel.",
"Retention":"Implement customer health indicators and early-warning triggers before renewal risk becomes unavoidable.",
"Expansion":"Create systematic account-growth plans tied to realized value, relationships, and whitespace opportunities."};
function calculate(){
 const dims={};state.a.questions.forEach(q=>{const v=state.responses[q.id],d=dims[q.dimension]??={e:0,p:0};d.e+=(v-1)*q.weight;d.p+=4*q.weight});
 const ds=Object.fromEntries(Object.entries(dims).map(([k,v])=>[k,Math.round(v.e/v.p*1000)/10]));
 const overall=Math.round(Object.values(ds).reduce((a,b)=>a+b,0)/Object.keys(ds).length*10)/10;
 const low=Object.keys(ds).sort((a,b)=>ds[a]-ds[b]);return {ds,overall,low,band:getBand(overall)};
}
function renderResults(){
 const r=calculate();show("#results");$("#resultTitle").textContent=state.a.title;$("#overallScore").textContent=r.overall;
 $("#band").textContent=r.band.label;$("#stage").textContent=`Stage: ${r.band.stage}`;$("#interpretation").textContent=r.band.message;
 $("#dimensions").innerHTML=Object.entries(r.ds).map(([d,s])=>`<div class="bar-row"><div class="bar-label"><b>${d}</b><span>${s}</span></div><div class="bar"><i style="width:${s}%"></i></div></div>`).join("");
 $("#constraints").innerHTML=r.low.slice(0,3).map(d=>`<div class="constraint"><b>${d}</b> — ${r.ds[d]}/100</div>`).join("");
 $("#recommendations").innerHTML=r.low.slice(0,3).map(d=>`<li>${recs[d]}</li>`).join("");
 $("#actionPath").innerHTML=`<div><b>30 Days</b><p>Validate the primary constraint, baseline the affected KPI, assign an executive owner, and define the first corrective initiative.</p></div><div><b>60 Days</b><p>Implement the highest-priority intervention, review leading indicators weekly, and remove cross-functional blockers.</p></div><div><b>90 Days</b><p>Measure business impact, standardize what worked, stop low-value activity, and select the next constraint.</p></div>`;
 $("#ctas").innerHTML=state.cfg.ctas.map(c=>`<a class="cta" href="${c.url}" ${c.type==="download"?'id="downloadPlan"':''}><b>Step ${c.step}</b>${c.title}</a>`).join("");
 setTimeout(()=>{const d=$("#downloadPlan");if(d)d.onclick=e=>{e.preventDefault();downloadPlan(r)}},0);
 if(state.lead.email && state.lead.consent){fetch("/api/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead:state.lead,assessment:state.a.id,overall:r.overall,band:r.band.label})}).catch(()=>{})}
 window.scrollTo({top:0,behavior:"smooth"});
}
function downloadPlan(r){
 const lines=[`FRA EXECUTIVE ACTION PLAN`,``,state.a.title,`Score: ${r.overall}/100 — ${r.band.label}`,`Stage: ${r.band.stage}`,``,r.band.message,``,`TOP CONSTRAINTS`,...r.low.slice(0,3).map(d=>`• ${d}: ${r.ds[d]}/100`),``,`PRIORITY ACTIONS`,...r.low.slice(0,3).map((d,i)=>`${i+1}. ${recs[d]}`),``,`30 DAYS`,`Validate the primary constraint, baseline the KPI, assign an executive owner, and define the first corrective initiative.`,``,`60 DAYS`,`Implement the highest-priority intervention, review leading indicators weekly, and remove cross-functional blockers.`,``,`90 DAYS`,`Measure business impact, standardize what worked, stop low-value activity, and select the next constraint.`,``,`FutureReady Advisors | futurereadyus.com`,`Directional executive diagnostic; not an audited benchmark.`];
 const blob=new Blob([lines.join("\n")],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="FRA-Executive-Action-Plan.txt";a.click();URL.revokeObjectURL(a.href);
}
$("#restart").onclick=()=>location.reload();
