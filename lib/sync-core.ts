import { XMLParser } from 'fast-xml-parser';
export const FEED_URL='https://brabble.ai/rss/hackathons.xml';
export const ATTRIBUTION='Discovered via Brabble.ai; verify eligibility, prizes and dates with the organizer.';
export function clean(value:unknown,max=1500){return String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim().slice(0,max)}
export function canonicalUrl(value:string){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('Unsafe feed URL');url.hash='';for(const key of [...url.searchParams.keys()])if(key.startsWith('utm_'))url.searchParams.delete(key);return url.toString()}
export function parseHackathonFeed(xml:string,now=Date.now()){
 if(xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported XML document');
 const parsed=new XMLParser({ignoreAttributes:false,processEntities:false,parseTagValue:false}).parse(xml);
 const items=parsed.rss?.channel?.item||parsed.feed?.entry||[];const entries=Array.isArray(items)?items:[items];const unique=new Map<string,any>();
 for(const item of entries.slice(0,250)){try{const name=clean(item.title,180);if(!name)continue;const value=typeof item.link==='string'?item.link:item.link?.['@_href'];const url=canonicalUrl(value);const description=clean(item.description||item.summary);const deadlineText=description.match(/Registration closes (.*? GMT)(?:\s*-|$)/i)?.[1];const deadline=deadlineText&&Number.isFinite(Date.parse(deadlineText))?new Date(deadlineText).toISOString():null;if(deadline&&Date.parse(deadline)<now)continue;unique.set(url,{id:'feed-'+url.split('/').filter(Boolean).pop(),name,url,description,deadline,format:/\bOnline\b/i.test(description)?'Online':/In person/i.test(description)?'In person':'Not specified',source:'Brabble.ai',sourceUrl:FEED_URL,attribution:ATTRIBUTION,eligibility:'Not verified — source includes student-restricted events. Review organizer rules.',prize:description.match(/Prize:\s*(.*?)(?:\s*-|$)/)?.[1]||'See source',seen:new Date(now).toISOString()});}catch{continue}}
 return [...unique.values()];
}
