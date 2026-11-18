// Какой стороной лежит билет — переживает перерисовку страницы при обновлении данных.
let keepFlipped = false;

export function mountIdCard(root) {
  const scene = root.querySelector('[data-idcard]');
  if (!scene) return () => {};

  const toggle = scene.querySelector('[data-idcard-toggle]');
  const tilt = scene.querySelector('[data-idcard-tilt]');
  const front = scene.querySelector('[data-idcard-front]');
  const back = scene.querySelector('[data-idcard-back]');
  const canTilt = matchMedia('(min-width: 601px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const events = new AbortController();
  const {signal} = events;
  const current = {x: 0, y: 0, glare: 0};
  const target = {...current};
  let frame = null;
  let lastTime = null;

  function draw(now) {
    const elapsed = lastTime === null ? 1000 / 60 : now - lastTime;
    const mix = 1 - Math.exp(-elapsed / 75);
    lastTime = now;
    let moving = false;
    for (const key of Object.keys(current)) {
      const delta = target[key] - current[key];
      if (Math.abs(delta) < 0.002) {
        current[key] = target[key];
      } else {
        current[key] += delta * mix;
        moving = true;
      }
    }

    tilt.style.setProperty('--rx', `${current.y * 12}deg`);
    tilt.style.setProperty('--ry', `${current.x * -16}deg`);
    tilt.style.setProperty('--gx', `${50 + current.x * 50}%`);
    tilt.style.setProperty('--gx-back', `${50 - current.x * 50}%`);
    tilt.style.setProperty('--gy', `${50 + current.y * 50}%`);
    tilt.style.setProperty('--glare', current.glare);
    frame = moving ? requestAnimationFrame(draw) : null;
    if (!moving) lastTime = null;
  }

  function schedule() {
    if (frame === null) frame = requestAnimationFrame(draw);
  }

  function reset() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = lastTime = null;
    Object.assign(current, {x: 0, y: 0, glare: 0});
    Object.assign(target, current);
    for (const name of ['--rx', '--ry', '--gx', '--gx-back', '--gy', '--glare']) {
      tilt.style.removeProperty(name);
    }
  }

  function leave() {
    if (!canTilt.matches) return;
    Object.assign(target, {x: 0, y: 0, glare: 0});
    schedule();
  }

  scene.addEventListener('pointermove', (event) => {
    if (!canTilt.matches || event.pointerType === 'touch') return;
    const bounds = scene.getBoundingClientRect();
    const normalize = (position, size) => Math.max(-1, Math.min(1, 2 * position / size - 1));
    target.x = normalize(event.clientX - bounds.left, bounds.width);
    target.y = normalize(event.clientY - bounds.top, bounds.height);
    target.glare = 1;
    schedule();
  }, {signal, passive: true});
  scene.addEventListener('pointerleave', leave, {signal});
  scene.addEventListener('pointercancel', leave, {signal});
  canTilt.addEventListener('change', reset, {signal});

  // The native button handles Enter and Space alongside clicks on either face.
  const apply = (flipped) => {
    keepFlipped = flipped;
    scene.toggleAttribute('data-idcard-flipped', flipped);
    toggle.setAttribute('aria-pressed', String(flipped));
    front.inert = flipped;
    back.inert = !flipped;
  };
  if (keepFlipped) apply(true);
  scene.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    apply(!scene.hasAttribute('data-idcard-flipped'));
  }, {signal});

  return () => {
    events.abort();
    reset();
  };
}
