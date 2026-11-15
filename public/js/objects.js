/* Предметы кабинета: студийные рендеры (SDF-рендер skill design-taste-frontend, product-render),
   прозрачный фон, webp. Картинки декоративные: смысл всегда дублируется текстом рядом. */
const SIZES = {folder: [947, 530], notebook: [944, 492], books: [939, 575], cap: [956, 626], lock: [556, 916]};

/** Один предмет. cls: hero | sm | float. */
export function obj(name, cls = '') {
  const [w, h] = SIZES[name] || SIZES.folder;
  return `<img class="obj ${cls}" src="/assets/3d/img/${name}.webp" width="${w}" height="${h}" alt="" decoding="async" loading="lazy">`;
}
/** Предмет в заголовке раздела. */
export const headObj = (name) => `<figure class="head-obj" aria-hidden="true">${obj(name, 'float')}</figure>`;

/** Композиция для экрана входа: шапочка, стопка учебников, блокнот, папка. */
export function collage() {
  return `<div class="collage" aria-hidden="true">${obj('cap', 'c-cap float')}${obj('books', 'c-books float d2')}${obj('notebook', 'c-note float d3')}${obj('folder', 'c-folder float d4')}</div>`;
}
