export const S = {data: null, day: null, week: 0, messages: [], busy: false, noticeFilter: 'all', queueFilter: 'active', roomQuery: '', version: 0, theme: 'system'};
export const lessonIndex = new Map();
export function indexLessons() {
  lessonIndex.clear();
  for (const day of S.data?.schedule || []) for (const lesson of day.lessons) lessonIndex.set(lesson.id, {lesson, day});
}
