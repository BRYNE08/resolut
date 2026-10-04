/** Deterministic ZAR formatting; retain cents when a price includes them. */
export const ZAR = (n: number) => {
  const [whole, cents] = n.toFixed(2).split(".");
  return "R " + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (cents === "00" ? "" : `.${cents}`);
};
