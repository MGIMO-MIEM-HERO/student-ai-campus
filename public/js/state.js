export const S = {data: null, day: null, week: 0, messages: [], busy: false, noticeFilter: 'all', newsCat: 'all', hwFilter: 'active', queueFilter: 'active', roomQuery: '', bld: 'А', pair: null, room: '', floor: null, modelMode: 'building', mapDate: null, routeOrigin: 'entry', routeEnabled: false, routeLesson: null, routeBlocked: false, routeNotice: '', focusMap: false, rz: -20, version: 0};
export const lessonIndex = new Map();
export function indexLessons() {
  lessonIndex.clear();
  for (const day of S.data?.schedule || []) for (const lesson of day.lessons) lessonIndex.set(lesson.id, {lesson, day});
}
