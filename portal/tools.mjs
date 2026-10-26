export async function transform(mode,input){
 if(new TextEncoder().encode(input).length>1048576)throw Error('Input limit: 1 MiB');
 switch(mode){
 case 'json':return JSON.stringify(JSON.parse(input),null,2);
 case 'encode':return btoa(Array.from(new TextEncoder().encode(input),b=>String.fromCharCode(b)).join(''));
 case 'decode':return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(input),c=>c.charCodeAt(0)));
 case 'sha':return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input))),b=>b.toString(16).padStart(2,'0')).join('');
 case 'url':{const u=new URL(input);if(!['https:','http:'].includes(u.protocol))throw Error('HTTP(S) URLs only');for(const k of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid|mc_cid|mc_eid)$/i.test(k))u.searchParams.delete(k);return u.href;}
 case 'ist':{if(!/(Z|[+-]\d{2}:\d{2})$/.test(input.trim()))throw Error('Include Z or explicit UTC offset');const d=new Date(input);if(!Number.isFinite(+d))throw Error('Invalid timestamp');return new Intl.DateTimeFormat('en-IN',{dateStyle:'full',timeStyle:'long',timeZone:'Asia/Kolkata'}).format(d);}
 case 'jsonl':{const rows=input.trim().split('\n');rows.forEach((x,i)=>{try{JSON.parse(x)}catch{throw Error('Invalid JSON at line '+(i+1))}});return rows.length+' valid JSONL records';}
 case 'env':return [...new Set(input.match(/\b[A-Z][A-Z0-9_]{2,}\b/g)||[])].map(k=>k+'=').join('\n');
 default:throw Error('Unknown tool');
 }}
if(typeof document!=='undefined'){document.querySelector('#run')?.addEventListener('click',async()=>{const output=document.querySelector('#output');try{output.textContent=await transform(document.querySelector('#mode').value,document.querySelector('#input').value)}catch(e){output.textContent='Error: '+e.message}})}
