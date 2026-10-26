import {getSyncStatus,syncCatalog} from '../../../lib/sync-service';
export const dynamic='force-dynamic';
// This maintenance route relies on the confirmed owner-private Sites access boundary.
// Do not make this Site public without adding an independent updater credential/role check.
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{return reply({status:await getSyncStatus(),instructions:'Owner-private catalog updater. POST this same endpoint with Sites service access obtained fresh from get_site. No visitor identity is required. It refreshes the attributed Brabble hackathon catalog and ten RSS/Atom news widgets, preserves prior data on failures, deduplicates URLs and records timestamps. Read GET after POST to verify persistence. Do not change sharing or place access tokens in task prompts.'})}catch{return reply({error:'Refresh storage unavailable'},503)}}
export async function POST(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return reply({error:'Cross-origin request rejected'},403);try{const report=await syncCatalog();return reply(report,report.status==='failed'||report.updates?.status==='failed'?502:200)}catch{return reply({error:'Catalog refresh unavailable'},503)}}
