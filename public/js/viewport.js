// Keep the same dialogs usable when a phone's keyboard changes the visual viewport.
let frame;
function updateViewport() {
  frame = null;
  const viewport = window.visualViewport;
  if (viewport && Math.abs(viewport.scale - 1) > .01) return;
  const height = viewport?.height ?? window.innerHeight;
  const top = viewport?.offsetTop ?? 0;
  const root = document.documentElement;
  root.style.setProperty('--viewport-height', `${height}px`);
  root.style.setProperty('--viewport-top', `${top}px`);
  root.style.setProperty('--viewport-bottom', `${Math.max(0, window.innerHeight - height - top)}px`);
  const editing = document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]');
  root.toggleAttribute('data-keyboard-open', !!editing && window.innerHeight - height > 120);
}
function scheduleViewport() {
  if (!frame) frame = requestAnimationFrame(updateViewport);
}
window.visualViewport?.addEventListener('resize', scheduleViewport, {passive: true});
window.visualViewport?.addEventListener('scroll', scheduleViewport, {passive: true});
window.addEventListener('resize', scheduleViewport, {passive: true});
document.addEventListener('focusin', scheduleViewport);
document.addEventListener('focusout', scheduleViewport);
updateViewport();
