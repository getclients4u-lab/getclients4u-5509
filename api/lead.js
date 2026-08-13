export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const webhook=process.env.FRA_LEAD_WEBHOOK_URL;
  if(!webhook) return res.status(204).end();
  try{
    const r=await fetch(webhook,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(req.body)});
    return res.status(r.ok?200:502).json({ok:r.ok});
  }catch(e){return res.status(502).json({ok:false});}
}