// Places the floating owl so it never covers the page's own controls, keeps the panel next to it,
// and lets the reader drag it to either side of the page (remembered per site).
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});

  const SIZE = 48;
  const EDGE = 16; // gap to the window edge
  const STEP = 56; // spacing between candidate spots along an edge
  const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

  /**
   * opts: { host, launcher, panel, settings(), save(patch) }
   * Returns { place(), placePanel(), isDrag() } — call place() after settings change.
   */
  function createLauncherController({ host, launcher, panel, settings, save, panelHeight = () => 600 }) {
    let current = null; // { side, top }
    let drag = null;
    let suppressClick = false;

    const site = () => location.hostname;
    const clampTop = (top) => Math.max(EDGE, Math.min(window.innerHeight - SIZE - EDGE, top));

    // Inside a fixed or sticky container: a persistent overlay such as a floating button,
    // a chat drawer or a sticky sidebar.
    function inFixedLayer(el) {
      for (let node = el, depth = 0; node && node !== document.body && depth < 25; node = node.parentElement, depth++) {
        const position = getComputedStyle(node).position;
        if (position === 'fixed' || position === 'sticky') return true;
      }
      return false;
    }

    // How much a spot would cover the page's controls. 0 = free.
    function overlap(side, top) {
      const left = side === 'left' ? EDGE : window.innerWidth - EDGE - SIZE;
      let score = 0;
      for (const fx of [0.15, 0.5, 0.85]) {
        for (const fy of [0.15, 0.5, 0.85]) {
          const x = left + SIZE * fx;
          const y = top + SIZE * fy;
          const hit = document.elementsFromPoint(x, y).find((el) => el !== host && el !== document.documentElement && el !== document.body);
          if (!hit) continue;
          const control = hit.closest(INTERACTIVE) || (hit.closest('svg, img') && hit.closest('[onclick], [role], a, button'));
          if (control && inFixedLayer(hit)) score += 1; // persistent control: avoid
          else if (control) score += 0.2; // scrolling content passes under anyway
        }
      }
      return score;
    }

    function candidates() {
      const bottom = clampTop(window.innerHeight - SIZE - 20);
      const list = [];
      for (const side of ['right', 'left']) {
        for (let top = bottom; top >= window.innerHeight * 0.35; top -= STEP) list.push({ side, top });
      }
      list.push({ side: 'right', top: clampTop(20) }, { side: 'left', top: clampTop(20) });
      return list;
    }

    function corner(position) {
      const [vertical, side] = position.split('-');
      return { side, top: clampTop(vertical === 'top' ? 20 : window.innerHeight - SIZE - 20) };
    }

    function choose() {
      const s = settings();
      const dragged = (s.launcherPlacements || {})[site()];
      if (dragged) return { side: dragged.side === 'left' ? 'left' : 'right', top: clampTop(dragged.y * window.innerHeight) };
      if (s.launcherPosition && s.launcherPosition !== 'auto') return corner(s.launcherPosition);
      // Automatic: keep the current spot while it's free; otherwise take the first free candidate.
      if (current && overlap(current.side, current.top) < 1) return current;
      let best = null;
      for (const spot of candidates()) {
        const score = overlap(spot.side, spot.top);
        if (score === 0) return spot;
        if (!best || score < best.score) best = { ...spot, score };
      }
      return best ? { side: best.side, top: best.top } : corner('bottom-right');
    }

    function apply(spot) {
      current = spot;
      launcher.style.top = `${spot.top}px`;
      launcher.style.bottom = 'auto';
      launcher.style.left = spot.side === 'left' ? `${EDGE}px` : 'auto';
      launcher.style.right = spot.side === 'right' ? `${EDGE}px` : 'auto';
      placePanel();
    }

    function place() {
      if (launcher.hidden || drag) return;
      apply(choose());
    }

    // Panel opens beside the button: same edge, above it in the lower half, below it in the upper half.
    function placePanel() {
      const narrow = window.innerWidth < 480;
      const style = panel.style;
      if (launcher.hidden || !current) {
        Object.assign(style, { top: 'auto', bottom: '20px', left: narrow ? '12px' : 'auto', right: narrow ? '12px' : `${EDGE}px` });
        style.height = `min(${panelHeight()}px, calc(100vh - 40px))`;
        markFreeEdges(narrow);
        return;
      }
      const gap = 12;
      const below = current.top + SIZE / 2 < window.innerHeight / 2;
      const room = below ? window.innerHeight - (current.top + SIZE + gap) - EDGE : current.top - gap - EDGE;
      style.height = `${Math.max(320, Math.min(panelHeight(), room))}px`;
      style.top = below ? `${current.top + SIZE + gap}px` : 'auto';
      style.bottom = below ? 'auto' : `${window.innerHeight - current.top + gap}px`;
      style.left = narrow ? '12px' : current.side === 'left' ? `${EDGE}px` : 'auto';
      style.right = narrow ? '12px' : current.side === 'right' ? `${EDGE}px` : 'auto';
      markFreeEdges(narrow);
    }

    // The edges that aren't pinned (away from the screen side and from the button) can be dragged
    // to resize the panel: data-edge-x is 'left' | 'right' | '' (none on narrow screens), data-edge-y 'top' | 'bottom'.
    function markFreeEdges(narrow) {
      panel.dataset.edgeX = narrow ? '' : panel.style.right !== 'auto' ? 'left' : 'right';
      panel.dataset.edgeY = panel.style.top === 'auto' ? 'top' : 'bottom';
    }

    // ---------------------------------------------------------------------------
    // Drag to move: drop the owl on either side of the page (remembered for this site).
    // ---------------------------------------------------------------------------

    launcher.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const rect = launcher.getBoundingClientRect();
      drag = {
        startX: e.clientX,
        startY: e.clientY,
        dx: e.clientX - rect.left,
        dy: e.clientY - rect.top,
        moved: false,
      };
      launcher.setPointerCapture(e.pointerId);
    });
    launcher.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
      drag.moved = true;
      launcher.classList.add('dragging');
      Object.assign(launcher.style, {
        left: `${Math.max(0, Math.min(window.innerWidth - SIZE, e.clientX - drag.dx))}px`,
        right: 'auto',
        top: `${Math.max(0, Math.min(window.innerHeight - SIZE, e.clientY - drag.dy))}px`,
      });
    });
    const endDrag = async (e) => {
      if (!drag) return;
      const { moved } = drag;
      drag = null;
      launcher.classList.remove('dragging');
      if (!moved) return;
      suppressClick = true;
      if (e) e.preventDefault();
      // It settles on the side of the page it was dropped on, at that height.
      const rect = launcher.getBoundingClientRect();
      const side = rect.left + SIZE / 2 < window.innerWidth / 2 ? 'left' : 'right';
      const top = clampTop(rect.top);
      apply({ side, top });
      const placements = { ...(settings().launcherPlacements || {}), [site()]: { side, y: top / window.innerHeight } };
      await save({ launcherPlacements: placements });
    };
    launcher.addEventListener('pointerup', endDrag);
    launcher.addEventListener('pointercancel', endDrag);

    // A drag ends with a click event; swallow it so dragging doesn't toggle the panel.
    launcher.addEventListener(
      'click',
      (e) => {
        if (suppressClick) {
          suppressClick = false;
          e.stopImmediatePropagation();
        }
      },
      true
    );

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(place, 150);
    });
    // Pages add floating buttons after load (chat widgets, X's drawers): re-check now and then.
    setInterval(() => {
      if (!document.hidden && !drag && settings().launcherPosition === 'auto') place();
    }, 2500);

    return { place, placePanel, hasCustomPlacement: () => Boolean((settings().launcherPlacements || {})[site()]) };
  }

  soroagent.createLauncherController = createLauncherController;
})(globalThis);
