import type { Transition, Variants } from 'motion/react';

/** Shared easing/duration (mirrors the CSS motion tokens). */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const transition = (duration = 0.45, delay = 0): Transition => ({
  duration,
  delay,
  ease: EASE,
});

/** Staggered entrance container — pair with `fadeUp` children. */
export const stagger = (staggerChildren = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
});

/** Default item entrance: fade + rise. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: transition(0.5) },
};

/** Subtle variant for dense lists/cards. */
export const fadeSoft: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: transition(0.35) },
};

/** Scale-in for popovers, badges, icons. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: transition(0.28) },
  exit: { opacity: 0, scale: 0.96, transition: transition(0.16) },
};

/** Slide-from-right for drawers/sheets. */
export const slideInRight: Variants = {
  hidden: { x: '100%' },
  show: { x: 0, transition: transition(0.35) },
  exit: { x: '100%', transition: transition(0.25) },
};

/** Route-level page transition (fade + tiny rise). */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: transition(0.38) },
  exit: { opacity: 0, y: -6, transition: transition(0.18) },
};
