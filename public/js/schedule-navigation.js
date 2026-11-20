import {mskNow,toMin} from './util.js';

export const roomKey=(lesson)=>lesson?.building&&lesson?.room?`${lesson.building}-${lesson.room}`:'';
export const scheduleEntries=(data)=>(data?.schedule||[]).flatMap((day)=>day.lessons.map((lesson)=>({lesson,date:day.date}))).sort((a,b)=>a.date.localeCompare(b.date)||toMin(a.lesson.start)-toMin(b.lesson.start));
export function nextPhysicalLesson(data,clock=mskNow()) {
  return scheduleEntries(data).find(({lesson,date})=>!lesson.cancelled&&lesson.format!=='Онлайн'&&roomKey(lesson)&&(date>clock.date||date===clock.date&&toMin(lesson.end)>clock.minutes));
}
export function nextTeacherLesson(data,teacher,clock=mskNow()) {
  return scheduleEntries(data).find(({lesson,date})=>!lesson.cancelled&&lesson.teacher?.key===teacher&&(date>clock.date||date===clock.date&&toMin(lesson.end)>clock.minutes));
}
export function findNavigationLesson(data,id) {return scheduleEntries(data).find(({lesson})=>lesson.id===id);}
export function syncNavigation(state,data) {
  if(!state.routeLesson)return;
  const entry=findNavigationLesson(data,state.routeLesson);
  if(!entry){state.routeBlocked=true;state.routeNotice='Занятие больше не найдено в расписании. Выберите актуальную пару.';return;}
  const {lesson:l,date}=entry;
  if(l.cancelled||l.format==='Онлайн'||!roomKey(l)){state.routeBlocked=true;state.routeNotice=l.cancelled?'Пара отменена. Маршрут к ней отключён.':'Пара проходит онлайн. Идти в аудиторию не нужно.';return;}
  const room=data.campus.rooms.find((r)=>r.key===roomKey(l));
  if(!room){state.routeBlocked=true;state.routeNotice='Для аудитории этой пары пока нет плана.';return;}
  const relocated=state.room&&state.room!==room.key;
  const floor=state.room!==room.key||!state.floor?room.floor:state.floor;
  Object.assign(state,{room:room.key,bld:room.building,floor,pair:l.pair,mapDate:date,routeBlocked:false,routeNotice:relocated?'Аудитория изменилась — маршрут перестроен.':''});
}
