export type CrossSignal = "CALL" | "PUT" | "NO_ACTION";

export function lastCrossoverSignal(
  shortSeries: number[],
  longSeries: number[]
): CrossSignal {
  if (shortSeries.length < 2 || longSeries.length < 2) return "NO_ACTION";
  const len = Math.min(shortSeries.length, longSeries.length);
  const sPrev = shortSeries[len - 2];
  const lPrev = longSeries[len - 2];
  const sNow = shortSeries[len - 1];
  const lNow = longSeries[len - 1];

  const wasBelowOrEqual = sPrev <= lPrev;
  const wasAboveOrEqual = sPrev >= lPrev;
  const isAbove = sNow > lNow;
  const isBelow = sNow < lNow;

  if (wasBelowOrEqual && isAbove) return "CALL";
  if (wasAboveOrEqual && isBelow) return "PUT";
  return "NO_ACTION";
}
