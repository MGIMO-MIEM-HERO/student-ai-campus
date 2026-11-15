const P = {
  today: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  schedule: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 10h18 M8 2v4 M16 2v4',
  study: 'M2 9l10-5 10 5-10 5z M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5 M22 9v6',
  requests: 'M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M14 2v5h5 M8 13h8 M8 17h8',
  more: 'M4 6h16 M4 12h16 M4 18h16',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.9 1.9 0 0 0 3.4 0',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
  check: 'M5 12l5 5L20 7',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  chevron: 'M9 6l6 6-6 6',
  clock: 'M12 7v5l3 2 M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z M9.5 10a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0',
  download: 'M12 3v12 M7 11l5 5 5-5 M4 21h16',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l7 4V6L7 10H4a1 1 0 0 0-1 1z M17.5 8.5a5 5 0 0 1 0 7',
  swap: 'M7 7h13 M16 3l4 4-4 4 M17 17H4 M8 13l-4 4 4 4',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  x: 'M6 6l12 12 M18 6L6 18',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16 M15 9h4a1 1 0 0 1 1 1v11 M2 21h20 M8 8h3 M8 12h3 M8 16h3',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5',
  send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
  cap: 'M2 9l10-5 10 5-10 5z M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5',
  user2: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  laptop: 'M4 5h16v11H4z M2 20h20',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z M4 19.5V22h16',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${P[name] || P.check}"/></svg>`;

/* Рисунок линией: лист с записями. Декоративный, для крупных блоков. */
export const sheet = (cls = '') => `<svg class="doodle ${cls}" viewBox="0 0 200 240" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M32 22l118-12c5-.5 9 3 9.500 8l18 176c.5 5-3 9-8 9.500L52 216c-5 .5-9-3-9.500-8L24 32c-.5-5 3-9.500 8-10z" fill="#fff"/><path d="M52 58c8-6 12 6 20 0s12 6 20 0 12 6 20 0 12 6 20 0"/><path d="M56 92c8-6 12 6 20 0s12 6 20 0 12 6 20 0"/><path d="M60 126c8-6 12 6 20 0s12 6 20 0 12 6 20 0 12 6 18 0"/><path d="M64 160h74"/><path d="M96 186l10 10 22-26"/></svg>`;
