/* apps/web/src/components/motion.ts — shared motion primitives (blueprint S10).
 * Stack: framer-motion + tailwindcss-animate. Tokens binding:
 * spring stiffness 300 damping 30 · durations 150/250/400 · one ease curve
 * [0.22, 1, 0.36, 1] · stagger 20-40ms · prefers-reduced-motion = fades only. */
import { motion, type Variants } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;

export const spring = { type: 'spring', stiffness: 300, damping: 30 } as const;

export const durations = { fast: 150, base: 250, slow: 400 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: durations.base / 1000, ease: EASE } },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

export const drawerVariants: Variants = {
  hidden: { x: '100%' },
  show: { x: 0, transition: { ...spring } },
  exit: { x: '100%', transition: { duration: durations.fast / 1000, ease: EASE } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: durations.fast / 1000, ease: EASE } },
  exit: { opacity: 0, transition: { duration: durations.fast / 1000 } },
};

export { motion };
