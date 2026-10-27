export const palette:string[][];
export function periodStatus(entry:{artworkPeriodEnd:string|null},now?:Date):string;
export function filterSponsors<T extends {id:string;brand:string;title:string;prize:string;description:string;track:string;prizeKind:string}>(entries:T[],options?:{query?:string;track?:string;kind?:string;savedOnly?:boolean;saved?:string[]}):T[];
export function buildPlan(entries:{id:string;brand:string;title:string;url:string;prize:string;period:string}[],ids:string[]):string;
