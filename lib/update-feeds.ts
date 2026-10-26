import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {canonicalUrl,clean,parseHackathonFeed} from './sync-core';
import {UPDATE_SOURCES,UPDATE_INTERVAL_MS,isRecent,type UpdateSource,type UpdateItem} from './feed-sources';
export {UPDATE_SOURCES,UPDATE_INTERVAL_MS,isRecent,type UpdateSource,type UpdateItem} from './feed-sources';
const list=(x:any)=>x===undefined?[]:Array.isArray(x)?x:[x];
const plain=(x:any)=>typeof x==='object'&&x!==null?x['#text']||'':x;
export function parseUpdateFeed(xml:string,source:UpdateSource,previous:UpdateItem[]=[],now=Date.now()):UpdateItem[]{
 if(xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g,''))||XMLValidator.validate(xml)!==true)throw Error('Invalid or unsupported RSS/Atom document');
 const old=new Map(previous.map(item=>[item.url,item.firstSeenAt]));
 if(source.id==='brabble')return parseHackathonFeed(xml,now).slice(0,30).map(item=>({title:item.name,url:item.url,summary:item.description.slice(0,420),publishedAt:null,firstSeenAt:old.get(item.url)||new Date(now).toISOString(),sourceId:source.id,source:source.name,category:source.category}));
 const parsed=new XMLParser({ignoreAttributes:false,processEntities:false,parseTagValue:false}).parse(xml);
 if(!parsed.rss?.channel&&!parsed.feed)throw Error('Expected RSS or Atom feed');
 const entries=list(parsed.rss?.channel?.item??parsed.feed?.entry);const unique=new Map<string,UpdateItem>();
 for(const item of entries.slice(0,1000)){
  try{
   const title=clean(plain(item.title),180);if(!title)continue;
   const link=list(item.link).find((l:any)=>typeof l==='string'||l?.['@_rel']==='alternate'||!l?.['@_rel']);
   const url=canonicalUrl(typeof link==='string'?link:link?.['@_href']||link?.['#text']);
   const rawDate=plain(item.pubDate||item.published||item.updated||item['dc:date']);const stamp=Date.parse(String(rawDate||''));
   const publishedAt=Number.isFinite(stamp)&&stamp<=now?new Date(stamp).toISOString():null;
   unique.set(url,{title,url,summary:clean(plain(item.description||item.summary||item.content),420),publishedAt,firstSeenAt:old.get(url)||new Date(now).toISOString(),sourceId:source.id,source:source.name,category:source.category});
  }catch{continue}
 }
 return [...unique.values()].sort((a,b)=>Date.parse(b.publishedAt||'1970-01-01')-Date.parse(a.publishedAt||'1970-01-01')).slice(0,30);
}
export async function fetchUpdateSource(source:UpdateSource,previous:any={},fetcher:typeof fetch=fetch,now=Date.now()){
 const checkedAt=new Date(now).toISOString();
 try{
  const headers:Record<string,string>={Accept:'application/rss+xml,application/atom+xml,application/xml','User-Agent':'Hackasandbox/0.6 RSS Reader'};
  if(previous.etag)headers['If-None-Match']=previous.etag;if(previous.lastModified)headers['If-Modified-Since']=previous.lastModified;
  const response=await fetcher(source.url,{redirect:'manual',headers,signal:AbortSignal.timeout(20000)});
  if(response.status===304&&previous.items?.length)return {...previous,checkedAt,lastSuccess:checkedAt,status:'unchanged',error:null};
  if(!response.ok)throw Error('Source returned HTTP '+response.status);
  const reader=response.body?.getReader();if(!reader)throw Error('Source returned no content');let bytes=0,xml='';const decoder=new TextDecoder();
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2000000){await reader.cancel();throw Error('Feed exceeded 2 MB limit')}xml+=decoder.decode(value,{stream:true})}xml+=decoder.decode()}finally{reader.releaseLock()}
  const items=parseUpdateFeed(xml,source,previous.items||[],now);if(!items.length)throw Error('Feed has no usable entries; previous items retained');
  return {checkedAt,lastSuccess:checkedAt,status:'succeeded',items,error:null,etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
 }catch(e:any){return {...previous,checkedAt,lastSuccess:previous.lastSuccess||null,status:'failed',items:previous.items||[],error:String(e.message||'Source unavailable').slice(0,160)}}
}
