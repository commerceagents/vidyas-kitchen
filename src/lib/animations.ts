export const transitions = {
  spring: {
    type: "spring",
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  },
  smooth: {
    type: "tween",
    ease: [0.22, 1, 0.36, 1],
    duration: 0.8,
  },
};

export const variants = {
  fadeIn: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  },
  scaleUp: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
  },
};
