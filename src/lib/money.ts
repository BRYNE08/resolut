/** Deterministic ZAR formatting — Intl locale data differs between server and browser. */
export const ZAR = (n: number) =>
  "R " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
