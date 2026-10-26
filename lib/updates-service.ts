import {env} from 'cloudflare:workers';
import {nextScheduledCheck} from './feed-sources';
import {UPDATE_SOURCES,fetchUpdateSource,isRecent,UPDATE_INTERVAL_MS,type UpdateItem} from './update-feeds';
export async function getUpdates(){
 if(!env.DB)throw Error('Update storage unavailable');
 const rows=await env.DB.prepare("SELECT id,body FROM sync_state WHERE id LIKE 'feed:%'").all();const states=new Map(rows.results.map((r:any)=>[r.id,JSON.parse(r.body)]));
 const feeds=UPDATE_SOURCES.map(source=>({...source,...(states.get('feed:'+source.id)||{status:'never-run',items:[],checkedAt:null,lastSuccess:null,error:null})}));
 const seen=new Set<string>();const items:UpdateItem[]=feeds.flatMap(f=>f.items).sort((a,b)=>Date.parse(b.publishedAt||b.firstSeenAt)-Date.parse(a.publishedAt||a.firstSeenAt)).filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true});
 const checks=feeds.map(f=>f.checkedAt).filter(Boolean).sort();const checkedAt=checks.at(-1)||null;
 return {feeds,items,checkedAt,intervalHours:6,nextCheckDue:nextScheduledCheck(),recentCount:items.filter(i=>isRecent(i)).length,healthy:feeds.filter(f=>['succeeded','unchanged'].includes(f.status)).length,totalSources:UPDATE_SOURCES.length};
}
export async function syncUpdates(){
 if(!env.DB)throw Error('Update storage unavailable');const db=env.DB;const now=new Date().toISOString();
 const lock=await db.prepare("INSERT INTO sync_state(id,body,updated) VALUES ('updates-lock','{}',?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated WHERE sync_state.updated < ? RETURNING id").bind(now,new Date(Date.now()-120000).toISOString()).first();
 if(!lock)return {...await getUpdates(),throttled:true};
 const previous=await getUpdates();
 if(previous.checkedAt&&Date.now()-Date.parse(previous.checkedAt)<60000)return {...previous,throttled:true};
 const pending=[...UPDATE_SOURCES];
 async function worker(){while(pending.length){const source=pending.shift()!;const old=previous.feeds.find(f=>f.id===source.id);const report=await fetchUpdateSource(source,old);await db.prepare('INSERT INTO sync_state(id,body,updated) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated=excluded.updated').bind('feed:'+source.id,JSON.stringify(report),new Date().toISOString()).run();}}
 await Promise.all([worker(),worker(),worker()]);return getUpdates();
}
