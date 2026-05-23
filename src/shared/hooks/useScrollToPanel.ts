import { useEffect, useRef, type RefObject } from 'react';

export const useScrollToPanel = <TKey extends string | null>(
  activeKey: TKey,
): {
  containerRef: RefObject<HTMLDivElement>;
} => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeKey || !containerRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const panel = containerRef.current?.querySelector<HTMLElement>('section[data-mutation-kind]');
      if (!panel) {
        return;
      }

      if (typeof panel.scrollIntoView === 'function') {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      panel.classList.add('ring-2', 'ring-accent', 'ring-offset-2');

      const focusTarget = panel.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), h2',
      );
      if (focusTarget) {
        if (focusTarget.tagName === 'H2') {
          focusTarget.setAttribute('tabindex', '-1');
        }
        focusTarget.focus({ preventScroll: true });
      }

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        panel.classList.remove('ring-2', 'ring-accent', 'ring-offset-2');
      }, 1400);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeKey]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return {
    containerRef,
  };
};
