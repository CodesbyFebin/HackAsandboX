import {syncUpdates,getUpdates} from './updates-service';
import {env} from 'cloudflare:workers';
import {FEED_URL,parseHackathonFeed} from './sync-core';
async function syncHackathonCatalog(){
 if(!env.DB)throw Error('Database unavailable');
 const now=new Date().toISOString(),old:any=await env.DB.prepare('SELECT body,updated FROM sync_state WHERE id=?').bind('catalog').first();
 const state=old?JSON.parse(old.body):{};
 if(state.status!=='failed'&&state.checkedAt&&Date.now()-Date.parse(state.checkedAt)<60000)return {...state,throttled:true};
 let report:any={checkedAt:now,lastSuccess:state.lastSuccess||null,source:FEED_URL,status:'failed',count:state.count||0,error:null};
 try{const headers:Record<string,string>={'Accept':'application/rss+xml,application/xml','User-Agent':'Hackasandbox/0.6 (+https://openhackathons-workshop.febinfrancis555.chatgpt.site)'};if(state.etag)headers['If-None-Match']=state.etag;if(state.lastModified)headers['If-Modified-Since']=state.lastModified;
 const res=await fetch(FEED_URL,{redirect:'manual',headers,signal:AbortSignal.timeout(20000)});
 if(res.status===304){report={...state,checkedAt:now,status:'unchanged',error:null};}
 else{if(!res.ok)throw Error('Source returned HTTP '+res.status);const reader=res.body?.getReader();if(!reader)throw Error('Source returned no body');const decoder=new TextDecoder();let xml='',bytes=0;try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2000000){await reader.cancel();throw Error('Source exceeded size limit')}xml+=decoder.decode(value,{stream:true})}xml+=decoder.decode()}finally{reader.releaseLock()}
 const entries=parseHackathonFeed(xml);if(!entries.length)throw Error('Source returned no usable open listings; previous records preserved');
 for(let i=0;i<entries.length;i+=50)await env.DB.batch(entries.slice(i,i+50).map(item=>env.DB!.prepare('INSERT INTO catalog_entries(url,body,seen) VALUES (?,?,?) ON CONFLICT(url) DO UPDATE SET body=excluded.body,seen=excluded.seen').bind(item.url,JSON.stringify(item),now)));
 report={...report,status:'succeeded',lastSuccess:now,count:entries.length,etag:res.headers.get('etag'),lastModified:res.headers.get('last-modified')};}
 }catch(e:any){report.error=String(e.message||'Refresh failed').slice(0,200)}
 await env.DB.prepare('INSERT INTO sync_state(id,body,updated) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated=excluded.updated').bind('catalog',JSON.stringify(report),now).run();
 await env.DB.prepare("DELETE FROM sync_state WHERE id IN (SELECT id FROM sync_state WHERE id LIKE 'ai:%' AND updated < ? LIMIT 500)").bind(new Date(Date.now()-172800000).toISOString()).run();
 return report;
}
export async function getSyncStatus(){if(!env.DB)throw Error('Database unavailable');const row:any=await env.DB.prepare('SELECT body FROM sync_state WHERE id=?').bind('catalog').first();const catalog=row?JSON.parse(row.body):{status:'never-run',lastSuccess:null,count:0};const updates=await getUpdates();return {...catalog,updates:{status:updates.healthy===updates.totalSources?'succeeded':updates.healthy?'partial':'failed',checkedAt:updates.checkedAt,healthy:updates.healthy,totalSources:updates.totalSources,count:updates.items.length,recentCount:updates.recentCount,feeds:updates.feeds.map(({id,name,status,lastSuccess,checkedAt,items,error})=>({id,name,status,lastSuccess,checkedAt,count:items.length,error}))}};}

export async function syncCatalog(){const [catalog,updates]=await Promise.all([syncHackathonCatalog(),syncUpdates()]);return {...catalog,updates:{status:updates.healthy===updates.totalSources?'succeeded':updates.healthy?'partial':'failed',checkedAt:updates.checkedAt,healthy:updates.healthy,totalSources:updates.totalSources,count:updates.items.length,recentCount:updates.recentCount,feeds:updates.feeds.map(({id,name,status,lastSuccess,checkedAt,items,error})=>({id,name,status,lastSuccess,checkedAt,count:items.length,error}))}}}
