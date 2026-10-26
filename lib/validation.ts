import { z } from "zod";
const text=z.string().trim().min(1).max(120);
const https=z.string().url().max(1000).refine(s=>{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password},"Use an HTTPS URL without credentials");
const date=z.string().max(40).refine(s=>Number.isFinite(Date.parse(s)),"Invalid date");
const repo=z.union([https,z.literal("")]).optional();
const files=z.record(z.string().max(100).refine(s=>!!s&&!s.includes("..")&&!s.startsWith("/")&&!s.includes("\\")),z.string().max(150000)).refine(f=>Object.keys(f).length<=30,"Maximum 30 files");
export const bodySchemas={
project:z.object({name:text,idea:z.string().max(3000).optional(),repo,eventId:z.string().max(120).optional(),files,created:date.optional()}),
event:z.object({name:text,org:text,description:z.string().min(1).max(3000),url:https,start:date,end:date,format:z.enum(["Online","In person","Hybrid"]),category:z.enum(["AI / ML","Developer tools","FinTech","AR / VR"]),eligibility:z.string().min(1).max(500),prize:z.string().max(100).optional()}).refine(b=>Date.parse(b.end)>=Date.parse(b.start),"End must follow start"),
saved:z.object({eventId:z.string().min(1).max(120)}),
reservation:z.object({name:text}),
showcase:z.object({name:text,projectId:z.string().min(1).max(120),description:z.string().min(1).max(3000)})
};
export function validateBody(kind:string,body:unknown){const schema=bodySchemas[kind as keyof typeof bodySchemas];return schema?schema.safeParse(body):{success:false as const,error:{issues:[{message:"Invalid record type"}]}}}
