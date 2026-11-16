import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {S} from '../public/js/state.js';
import {floorLayout} from '../public/js/campus.js';
import {buildRoute,roomDoor} from '../public/js/wayfinding.js';
import {nextPhysicalLesson,syncNavigation} from '../public/js/schedule-navigation.js';

const campus=JSON.parse(execFileSync('python3',['-c','import campus_data,json; print(json.dumps(campus_data.directory()))'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}));
S.data={campus,schedule:[]};
const inside=(p,r)=>p[0]>=r.x-.01&&p[0]<=r.x+r.w+.01&&p[1]>=r.y-.01&&p[1]<=r.y+r.h+.01;
function validateLeg(segment,building,extraRooms=[]) {
  const layout=floorLayout(building,segment.floor);
  const corridors=layout.corridors||[{x:8,y:94,w:584,h:36},{x:266,y:8,w:68,h:86}];
  const allowed=[...corridors,...extraRooms.filter((r)=>r.floor===segment.floor).map((r)=>layout.boxes.find((b)=>b.r.key===r.key))];
  for(let i=1;i<segment.points.length;i++)for(let step=0;step<=20;step++) {
    const a=segment.points[i-1],b=segment.points[i],t=step/20,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    assert.ok(allowed.some((r)=>inside(p,r)),`Path leaves corridors at ${building}/${segment.floor}: ${p}`);
  }
}
test('every room is reachable from its building entrance without crossing walls or courtyards',()=>{
  for(const target of campus.rooms) {
    const route=buildRoute({target,rooms:campus.rooms,layoutFor:(f)=>floorLayout(target.building,f)});
    assert.ok(route,`No route for ${target.key}`);
    assert.equal(route.segments.length,target.floor===1?1:2);
    route.segments.forEach((segment)=>validateLeg(segment,target.building,[target]));
    const box=floorLayout(target.building,target.floor).boxes.find((b)=>b.r.key===target.key);
    assert.deepEqual(route.segments.at(-1).points.at(-1),roomDoor(box,floorLayout(target.building,target.floor)).inside);
  }
});
test('same-floor and different-floor routes from another room use the circulation network',()=>{
  const source=campus.rooms.find((r)=>r.key==='А-301');
  for(const key of ['А-324','А-624']) {
    const target=campus.rooms.find((r)=>r.key===key),route=buildRoute({target,origin:source.key,rooms:campus.rooms,layoutFor:(f)=>floorLayout('А',f)});
    assert.ok(route);assert.equal(route.segments.length,target.floor===source.floor?1:2);
    route.segments.forEach((segment)=>validateLeg(segment,'А',[source,target]));
  }
  assert.equal(buildRoute({target:source,origin:source.key,rooms:campus.rooms,layoutFor:(f)=>floorLayout('А',f)}).arrived,true);
});
const lesson=(id,extra={})=>({id,title:'Математика',start:'10:40',end:'12:10',pair:2,building:'А',room:'304',format:'Очно',cancelled:false,...extra});
test('next class skips ended, cancelled and online lessons and includes an ongoing physical class',()=>{
  const data={schedule:[{date:'2026-11-16',lessons:[lesson('past',{start:'08:00',end:'09:00'}),lesson('cancel',{cancelled:true}),lesson('online',{format:'Онлайн'}),lesson('physical')]}]};
  assert.equal(nextPhysicalLesson(data,{date:'2026-11-16',minutes:660}).lesson.id,'physical');
  assert.equal(nextPhysicalLesson(data,{date:'2026-11-16',minutes:800}),undefined);
});
test('room/time changes update a pinned route; cancellation/online stop routing; source-floor view survives a refresh',()=>{
  const state={routeLesson:'class',room:'А-304',floor:1},data={campus,schedule:[{date:'2026-11-17',lessons:[lesson('class')]}]};
  syncNavigation(state,data);assert.equal(state.floor,1);
  data.schedule[0].lessons[0]=lesson('class',{building:'Б',room:'512',pair:3,start:'12:40',end:'14:10'});
  syncNavigation(state,data);assert.equal(state.room,'Б-512');assert.equal(state.floor,5);assert.equal(state.pair,3);assert.equal(state.mapDate,'2026-11-17');assert.equal(state.routeBlocked,false);assert.match(state.routeNotice,/перестроен/);
  data.schedule[0].lessons[0].cancelled=true;syncNavigation(state,data);assert.equal(state.routeBlocked,true);
  data.schedule[0].lessons[0]=lesson('class',{format:'Онлайн'});syncNavigation(state,data);assert.equal(state.routeBlocked,true);assert.match(state.routeNotice,/онлайн/);
  data.schedule=[];syncNavigation(state,data);assert.equal(state.routeBlocked,true);
});
