const state={cfg:null,a:null,i:0,responses:{},lead:{}};
const $=s=>document.querySelector(s);
const show=id=>{["#hero","#quiz","#lead","#results"].forEach(x=>{const el=$(x);if(el)el.classList.add("hidden")});const el=$(id);if(el)el.classList.remove("hidden")};

// Funnel analytics — logs to Vercel Analytics + self-hosted /api/event dashboard
function track(type,extra){
  try{
    const data=Object.assign({type,page:location.pathname},extra||{});
    try{window.va('event',{name:type,data})}catch(_){}
    try{fetch('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).catch(function(){})}catch(_){}
  }catch(_){}
}

fetch("/diagnostic/diagnostics.json").then(r=>r.json()).then(cfg=>{
  state.cfg=cfg; $("#consentText").textContent=cfg.leadCapture.consentText;
  cfg.assessments.forEach(a=>{
    const d=document.createElement("article");d.className="card";
    d.innerHTML=`<div class="eyebrow">${a.short.toUpperCase()}</div><h3>${a.title}</h3><p>${a.description}</p><span class="start-hint">Start Diagnostic →</span>`;
    d.onclick=()=>start(a); $("#assessmentCards").appendChild(d);
  });
});
function start(a){state.a=a;state.i=0;state.responses={};show("#quiz");window.scrollTo({top:0,behavior:"smooth"});track("diagnostic_started",{cta:"assessment-card",text:a.id});renderQ()}
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
$("#leadForm").onsubmit=e=>{
  e.preventDefault();const fd=new FormData(e.target);state.lead=Object.fromEntries(fd.entries());
  if(state.lead.email&&state.lead.consent){
    const r=calculate();
    track("lead_submitted",{cta:"lead-form",text:state.a.id,score:r.overall,band:r.band.label});
    fetch("/api/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead:state.lead,assessment:state.a.id,overall:r.overall,band:r.band.label})}).catch(()=>{});
  }
  renderResults();
};
function getBand(s){return state.cfg.bands.find(b=>s>=b.min&&s<=b.max)||state.cfg.bands.at(-1)}
const recs={
"Strategy":"Clarify the 12–24 month growth thesis and translate it into three measurable enterprise priorities.",
"Revenue":"Instrument the revenue engine from qualified pipeline through retention and expansion; assign one owner per leakage point.",
"Operations":"Create a single operating view for initiatives, owners, dependencies, blockers, outcomes, and intervention decisions.",
"AI Alignment":"Tie AI investments to quantified revenue, margin, speed, quality, or customer-experience outcomes.",
"Business Value":"Prioritize AI use cases using business value, feasibility, risk, and time-to-impact before selecting tools.",
"Data & Systems":"Assess whether the data and systems required for priority AI use cases are accessible, reliable, and integrable.",
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
  $("#constraints").innerHTML=r.low.slice(0,3).map(d=>`<div class="constraint"><b>${d}</b><span class="score-pill">${r.ds[d]}/100</span></div>`).join("");
  $("#recommendations").innerHTML=r.low.slice(0,3).map(d=>`<li>${recs[d]}</li>`).join("");
  $("#actionPath").innerHTML=`<div><b>30 Days</b><p>Validate the primary constraint, baseline the affected KPI, assign an executive owner, and define the first corrective initiative.</p></div><div><b>60 Days</b><p>Implement the highest-priority intervention, review leading indicators weekly, and remove cross-functional blockers.</p></div><div><b>90 Days</b><p>Measure business impact, standardize what worked, stop low-value activity, and select the next constraint.</p></div>`;
  const ctaClass={download:"btn btn-primary",consultation:"btn btn-secondary","strategy-session":"btn btn-secondary"};
  const ctaTrack={download:"action_plan_downloaded",consultation:"consultation_clicked","strategy-session":"strategy_session_clicked"};
  $("#ctas").innerHTML=state.cfg.ctas.map(c=>`<a class="${ctaClass[c.type]||"btn btn-secondary"}" href="${c.url}" data-track="${ctaTrack[c.type]||""}" ${c.type==='download'?'id="downloadPlan"':''}><span><small>Step ${c.step}</small>${c.title}</span></a>`).join("");
  setTimeout(()=>{const d=$("#downloadPlan");if(d)d.onclick=e=>{e.preventDefault();downloadPlan(r)}},0);
  window.scrollTo({top:0,behavior:"smooth"});
  track("diagnostic_completed",{cta:"results",text:state.a.id,score:r.overall,band:r.band.label});
}
function downloadPlan(r){
  const lines=[`FRA EXECUTIVE ACTION PLAN`,``,state.a.title,`Score: ${r.overall}/100 — ${r.band.label}`,`Stage: ${r.band.stage}`,``,r.band.message,``,`TOP CONSTRAINTS`,...r.low.slice(0,3).map(d=>`• ${d}: ${r.ds[d]}/100`),``,`PRIORITY ACTIONS`,...r.low.slice(0,3).map((d,i)=>`${i+1}. ${recs[d]}`),``,`30 DAYS`,`Validate the primary constraint, baseline the KPI, assign an executive owner, and define the first corrective initiative.`,``,`60 DAYS`,`Implement the highest-priority intervention, review leading indicators weekly, and remove cross-functional blockers.`,``,`90 DAYS`,`Measure business impact, standardize what worked, stop low-value activity, and select the next constraint.`,``,`FutureReady Advisors | futurereadyus.com`,`Directional executive diagnostic; not an audited benchmark.`];
  const blob=new Blob([lines.join("\n")],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="FRA-Executive-Action-Plan.txt";a.click();URL.revokeObjectURL(a.href);
  // tracking handled by the delegated [data-track] listener
}
$("#restart").onclick=()=>location.reload();

// Delegated funnel tracking for result CTAs (built dynamically)
document.addEventListener("click",e=>{
  const t=e.target.closest?e.target.closest("[data-track]"):null;
  if(!t)return;
  const type=t.getAttribute("data-track");
  if(type)track(type,{cta:(t.className||"").toString(),href:t.getAttribute("href")||"",text:state.a?state.a.id:""});
},true);
