export const UPDATE_INTERVAL_MS=6*60*60*1000;
// Matches the existing six-hour automation, beginning 26 Oct 2026 at 04:44:54 IST.
export function nextScheduledCheck(now=Date.now()){const anchor=Date.parse('2026-10-25T23:14:54Z');return new Date(anchor+(Math.floor((now-anchor)/UPDATE_INTERVAL_MS)+1)*UPDATE_INTERVAL_MS).toISOString();}
export const UPDATE_SOURCES=[
 {id:'brabble',name:'Brabble Hackathons',url:'https://brabble.ai/rss/hackathons.xml',home:'https://brabble.ai/developers',category:'Hackathons',note:'Aggregated opportunities; confirm eligibility and deadlines with organizers.'},
 {id:'devfolio',name:'Devfolio',url:'https://devfolio.co/blog/rss/',home:'https://devfolio.co/blog/',category:'Hackathons',note:'Platform news, hackathon announcements and recaps.'},
 {id:'mlh',name:'Major League Hacking',url:'https://blog.mlh.com/feed',home:'https://blog.mlh.com/',category:'Hackathons',note:'Official MLH announcements and community stories.'},
 {id:'dev-hackathon',name:'DEV Hackathons',url:'https://dev.to/feed/tag/hackathon',home:'https://dev.to/t/hackathon',category:'Hackathons',note:'Community posts; announcements and claims are not organizer-verified.'},
 {id:'dev-ai',name:'DEV AI',url:'https://dev.to/feed/tag/ai',home:'https://dev.to/t/ai',category:'Developer hubs',note:'Community-written AI news and build guides.'},
 {id:'hugging-face',name:'Hugging Face',url:'https://huggingface.co/blog/feed.xml',home:'https://huggingface.co/blog',category:'Developer hubs',note:'Models, datasets, open-source tooling and research.'},
 {id:'github',name:'GitHub Changelog',url:'https://github.blog/changelog/feed/',home:'https://github.blog/changelog/',category:'Developer hubs',note:'Official GitHub product and developer-tool updates.'},
 {id:'google',name:'Google Developers',url:'https://developers.googleblog.com/feeds/posts/default/?alt=rss',home:'https://developers.googleblog.com/',category:'Developer hubs',note:'Official developer ecosystem announcements.'},
 {id:'stackoverflow',name:'Stack Overflow',url:'https://stackoverflow.blog/feed/',home:'https://stackoverflow.blog/',category:'Developer hubs',note:'Engineering, AI and developer-community articles.'},
 {id:'nvidia',name:'NVIDIA Developer',url:'https://developer.nvidia.com/blog/feed/',home:'https://developer.nvidia.com/blog/',category:'Developer hubs',note:'GPU computing, inference and development guides.'},
] as const;
export type UpdateSource=typeof UPDATE_SOURCES[number];
export type UpdateItem={title:string;url:string;summary:string;publishedAt:string|null;firstSeenAt:string;sourceId:string;source:string;category:string};
export function isRecent(item:UpdateItem,now=Date.now()){const stamp=Date.parse(item.publishedAt||'');return Number.isFinite(stamp)&&stamp>=now-UPDATE_INTERVAL_MS&&stamp<=now;}
