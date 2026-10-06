'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const S=require('../agent-office-deploy/dist/mission-schedules');
const item={title:'Brief',source:'ChatGPT',start:'2026-10-06T08:00',repeat:'daily',timezone:'America/Vancouver',notes:''};
test('Vancouver daily recurrence follows DST, weekly and monthly skip correctly',()=>{
 assert.equal(new Date(S.nextRun(item,Date.parse('2026-11-01T16:01Z'))).toISOString(),'2026-11-02T15:00:00.000Z');
 assert.equal(new Date(S.nextRun({...item,timezone:'America/Los_Angeles'},Date.parse('2026-11-01T16:01Z'))).toISOString(),'2026-11-02T16:00:00.000Z');
 assert.equal(new Date(S.nextRun({...item,repeat:'weekly'},Date.parse('2026-10-06T16:00Z'))).toISOString(),'2026-10-13T15:00:00.000Z');
 assert.equal(new Date(S.nextRun({...item,start:'2026-01-31T08:00',repeat:'monthly'},Date.parse('2026-02-01T00:00Z'))).toISOString(),'2026-03-31T15:00:00.000Z');
});
test('invalid dates, timezone and nonexistent DST times are rejected',()=>{
 for(const patch of [{start:'2026-02-30T08:00'},{timezone:'wrong'},{start:'2026-03-08T02:30'},{source:'Penny'}]) assert.throws(()=>S.validate({...item,...patch}));
 assert.deepEqual(S.validate(item),item);
});
test('past one-time schedules never imply successful execution',()=>{
 const past=S.nextRun({...item,repeat:'once'},Date.parse('2026-10-07T00:00Z'));
 assert.equal(past,Date.parse('2026-10-06T15:00Z'));
 assert.match(S.countdown(past,Date.parse('2026-10-07T00:00Z')),/execution unconfirmed/);
 assert.equal(S.countdown(null),'Next run unavailable');
});
