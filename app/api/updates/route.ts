import {getUpdates} from '../../../lib/updates-service';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await getUpdates(),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Fresh updates are unavailable. Please try again.'},{status:503})}}
