const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  '[role="button"]:not([aria-disabled="true"])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type Direction = 'up' | 'down' | 'left' | 'right';

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const isVisible = (el: HTMLElement): boolean => {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
};

const getFocusableElements = (): HTMLElement[] => {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  return nodes.filter(isVisible);
};

const findNextFocusTarget = (
  fromRect: DOMRect,
  direction: Direction,
  candidates: HTMLElement[],
): HTMLElement | null => {
  const fromCenterX = fromRect.left + fromRect.width / 2;
  const fromCenterY = fromRect.top + fromRect.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = centerX - fromCenterX;
    const dy = centerY - fromCenterY;

    let primary: number;
    let cross: number;
    let ahead: boolean;

    switch (direction) {
      case 'up':
        primary = -dy;
        cross = dx;
        ahead = dy < -1;
        break;
      case 'down':
        primary = dy;
        cross = dx;
        ahead = dy > 1;
        break;
      case 'left':
        primary = -dx;
        cross = dy;
        ahead = dx < -1;
        break;
      case 'right':
        primary = dx;
        cross = dy;
        ahead = dx > 1;
        break;
    }

    if (!ahead) {
      continue;
    }

    const score = primary + Math.abs(cross) * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
};

const focusFirstElement = () => {
  const [first] = getFocusableElements();
  first?.focus();
};

const handleKeyDown = (event: KeyboardEvent) => {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) {
    return;
  }

  const active = document.activeElement as HTMLElement | null;
  const candidates = getFocusableElements();

  if (!active || active === document.body || !candidates.includes(active)) {
    focusFirstElement();
    event.preventDefault();
    return;
  }

  const fromRect = active.getBoundingClientRect();
  const next = findNextFocusTarget(
    fromRect,
    direction,
    candidates.filter((el) => el !== active),
  );

  if (next) {
    next.focus();
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    event.preventDefault();
  }
};

let initialized = false;

const activate = () => {
  if (initialized) {
    return;
  }
  initialized = true;
  window.addEventListener('keydown', handleKeyDown, { capture: true });

  window.setTimeout(() => {
    if (!document.activeElement || document.activeElement === document.body) {
      focusFirstElement();
    }
  }, 500);
};

export const initTvNavigation = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (document.documentElement.dataset.platform === 'tv') {
    activate();
    return;
  }

  const observer = new MutationObserver(() => {
    if (document.documentElement.dataset.platform === 'tv') {
      activate();
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-platform'],
  });
};
