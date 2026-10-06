(function(root){
'use strict';
const parts=(ms,zone)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(ms).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
function wallTime(date,zone){
 const target=Date.parse(date+'Z'); let value=target;
 for(let i=0;i<4;i++){const p=parts(value,zone);const delta=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);if(!delta)return value;value+=delta;}return null;
}
function nextRun(item,now=Date.now()){
 if(item.repeat==='once')return wallTime(item.start,item.timezone);
 const start=Date.parse(item.start.slice(0,10)+'T00:00:00Z'),p=parts(now,item.timezone),today=Date.UTC(p.year,p.month-1,p.day);
 for(let day=Math.max(start,today);day<=Math.max(start,today)+370*86400000;day+=86400000){
  if(item.repeat==='weekly'&&(day-start)%(7*86400000))continue;
  if(item.repeat==='monthly'&&new Date(day).getUTCDate()!==Number(item.start.slice(8,10)))continue;
  const value=wallTime(new Date(day).toISOString().slice(0,10)+item.start.slice(10),item.timezone);if(value!==null&&value>now)return value;
 }return null;
}
function validate(raw){
 if(!raw||typeof raw!=='object')throw new Error('Invalid schedule.');
 const item={title:String(raw.title||'').trim().slice(0,120),source:raw.source,start:raw.start,repeat:raw.repeat,timezone:String(raw.timezone||'America/Vancouver'),notes:String(raw.notes||'').slice(0,2000)};
 if(!item.title||!['ChatGPT','Claude','Other'].includes(item.source)||!['once','daily','weekly','monthly'].includes(item.repeat))throw new Error('Enter a title, source, and repeat schedule.');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(item.start||'')||!Number.isFinite(Date.parse(item.start+'Z')))throw new Error('Enter a valid date and time.');
 if(new Date(item.start+'Z').toISOString().slice(0,16)!==item.start||wallTime(item.start,item.timezone)===null)throw new Error('That local time does not exist. Choose another time.');
 return item;
}
function countdown(ms,now=Date.now()){
 if(!Number.isFinite(ms))return 'Next run unavailable';
 let s=Math.ceil((ms-now)/1000);if(s<=0)return 'Scheduled time reached · execution unconfirmed';
 const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;return `In ${d?d+'d ':''}${h}h ${Math.floor(s/60)}m ${s%60}s`;
}
const api={wallTime,nextRun,validate,countdown};if(typeof module!=='undefined')module.exports=api;else root.MissionSchedules=api;
})(typeof window!=='undefined'?window:globalThis);
