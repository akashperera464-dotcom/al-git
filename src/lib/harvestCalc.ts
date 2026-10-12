export function calculateHarvest(grossKg: number, deductionPercentage: number, pricePerKg: number) {
  const netKg = +(grossKg * (1 - Math.min(100, Math.max(0, deductionPercentage)) / 100)).toFixed(1);
  return { netKg, amount: +(netKg * Math.max(0, pricePerKg)).toFixed(2) };
}
