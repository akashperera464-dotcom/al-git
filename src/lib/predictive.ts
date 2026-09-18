/**
 * Verda · Deterministic Decision Engines
 * ------------------------------------------------------------------
 * IMPORTANT (per architecture spec):
 *  - Weather / environmental alerts use STRICT deterministic If/Else logic.
 *    There is NO AI / no probabilistic model here.
 *  - The ONLY module permitted to call an external LLM (Gemini / DeepSeek)
 *    is the AI & Analytics module (see modules/AiAnalytics).
 *
 * These engines are pure functions — ideal for unit testing and for being
 * re-run by the background FCM trigger (see Firestore function `onSupplierTick`).
 */

export type CropStage = "nursery" | "young" | "plucking" | "pruned";
export type AdviceLevel = "critical" | "due" | "optimal" | "hold" | "info";

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  rainMm: number;
  rainProb: number; // 0-100
  windKph: number;
  condition: string;
}

export interface FertilizerInput {
  lastApplicationDate: string; // ISO yyyy-mm-dd
  cropStage: CropStage;
  cultivar: string;
  soilMoisturePct: number; // 0-100
  temperatureC: number;
  forecast: WeatherDay[]; // next N days
  region: string;
}

export interface RainWindow {
  startIdx: number;
  endIdx: number;
  totalMm: number;
  label: string;
}

export interface FertilizerAdvice {
  level: AdviceLevel;
  score: number; // 0-100 readiness/urgency composite
  title: string;
  message: string;
  recommendedDate: string;
  daysFromLastApp: number;
  daysUntilRecommended: number;
  intervalDays: number;
  rainWindow: RainWindow | null;
  reasons: string[];
}

const MS_PER_DAY = 86400000;

/** Standard nutrient re-application cadence by physiological stage. */
export function intervalForStage(stage: CropStage): number {
  // Deterministic table — based on TRI (Tea Research Institute) guidance.
  switch (stage) {
    case "nursery":
      return 30;
    case "young":
      return 60;
    case "plucking":
      return 120;
    case "pruned":
      return 75;
    default:
      return 120;
  }
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).setHours(0, 0, 0, 0);
  const b = new Date(toIso).setHours(0, 0, 0, 0);
  return Math.round((b - a) / MS_PER_DAY);
}

/** Find the first reliable "wash-in" window: 5–35mm the day after application. */
export function findRainWindow(forecast: WeatherDay[]): RainWindow | null {
  let running = 0;
  let startIdx = -1;
  for (let i = 0; i < forecast.length; i += 1) {
    const d = forecast[i];
    if (d.rainMm >= 5 && d.rainMm <= 35 && d.rainProb >= 45) {
      if (startIdx === -1) startIdx = i;
      running += d.rainMm;
      // close a window once we've banked a useful amount
      if (running >= 8) {
        return {
          startIdx,
          endIdx: i,
          totalMm: Math.round(running),
          label: `Day +${startIdx + 1} to +${i + 1}`,
        };
      }
    } else if (startIdx !== -1) {
      // broke the chain — restart search
      startIdx = -1;
      running = 0;
    }
  }
  return null;
}

const LEVEL_META: Record<AdviceLevel, { title: string; scoreBase: number }> = {
  critical: { title: "Critically Overdue", scoreBase: 92 },
  due: { title: "Application Now Due", scoreBase: 78 },
  optimal: { title: "Optimal Window Open", scoreBase: 64 },
  hold: { title: "Conditions Favour Holding", scoreBase: 30 },
  info: { title: "Informational", scoreBase: 40 },
};

/**
 * The VVIP Supplier Predictive Calculator.
 * Cross-references Last Fertilizer Application Date × precipitation forecast
 * × soil conditioning window to produce the next-cycle recommendation.
 */
export function evaluateFertilizerWindow(input: FertilizerInput, todayIso: string): FertilizerAdvice {
  const interval = intervalForStage(input.cropStage);
  const daysFromLastApp = daysBetween(input.lastApplicationDate, todayIso);
  const overdueDays = daysFromLastApp - interval;
  const window = findRainWindow(input.forecast);

  const reasons: string[] = [];
  let level: AdviceLevel;

  // 1) ---- Overdue logic (deterministic) ----
  if (overdueDays > 14) {
    level = "critical";
    reasons.push(`Cycle overdue by ${overdueDays} days (expected every ${interval} days for ${input.cropStage} stage).`);
  } else if (overdueDays >= 0) {
    level = "due";
    reasons.push(`Cycle reached (${daysFromLastApp}/${interval} days) for ${input.cultivar}.`);
  } else if (overdueDays >= -14) {
    // approaching due date — only recommend if conditions are good
    level = window ? "optimal" : "hold";
    reasons.push(`Due in ${Math.abs(overdueDays)} day(s) — pre-scheduling assessed.`);
  } else {
    level = "hold";
    reasons.push(`Only ${daysFromLastApp} of ${interval} days elapsed — too early to re-apply.`);
  }

  // 2) ---- Heavy-rain penalty: leaching / runoff risk ----
  const tomorrow = input.forecast[0];
  if (tomorrow && tomorrow.rainMm > 40) {
    reasons.push(`⚠ Heavy rain (${tomorrow.rainMm}mm) expected tomorrow — defer to avoid nutrient leaching.`);
    if (level === "due" || level === "critical") level = level === "critical" ? "critical" : "due";
  }

  // 3) ---- Soil moisture conditioning ----
  if (input.soilMoisturePct < 25) {
    reasons.push(`Soil moisture low (${input.soilMoisturePct}%) — apply only if irrigation or rain is imminent.`);
  } else if (input.soilMoisturePct > 80) {
    reasons.push(`Soil saturated (${input.soilMoisturePct}%) — wait for drainage before application.`);
  } else {
    reasons.push(`Soil moisture in ideal band (${input.soilMoisturePct}%) for nutrient uptake.`);
  }

  // 4) ---- Recommended date ----
  let recommendedIdx = window ? window.startIdx : 0;
  if (level === "hold") recommendedIdx = Math.max(0, Math.abs(overdueDays)); // earliest sensible
  if (tomorrow && tomorrow.rainMm > 40) recommendedIdx = Math.max(recommendedIdx, 2);
  const recommendedDate = new Date(new Date(todayIso).getTime() + recommendedIdx * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  const daysUntilRecommended = daysBetween(todayIso, recommendedDate);

  if (window) {
    reasons.push(`Best wash-in window: ${window.label} (~${window.totalMm}mm) — light rain activates nutrients without runoff.`);
  } else if (tomorrow && tomorrow.rainMm <= 2) {
    reasons.push("Dry spell ahead with no activating rainfall — schedule light irrigation after spreading.");
  }

  const meta = LEVEL_META[level];
  let score = meta.scoreBase;
  if (window) score = Math.min(100, score + 8);
  if (input.soilMoisturePct >= 30 && input.soilMoisturePct <= 70) score = Math.min(100, score + 4);
  score = Math.max(12, Math.round(score));

  const message =
    level === "critical"
      ? `Apply ${input.cultivar} nutrient cycle immediately — preferably on ${recommendedDate} when ${window ? `~${window.totalMm}mm rain washes it in` : "soil is workable"}.`
      : level === "due"
        ? `Schedule the next application for ${recommendedDate} to stay on the ${interval}-day cadence.`
        : level === "optimal"
          ? `A clean agronomic window opens ${window ? window.label : "soon"} — lock ${recommendedDate} in now.`
          : `Hold off. Next sensible date is ${recommendedDate} (${daysUntilRecommended} day(s) away).`;

  return {
    level,
    score,
    title: meta.title,
    message,
    recommendedDate,
    daysFromLastApp,
    daysUntilRecommended,
    intervalDays: interval,
    rainWindow: window,
    reasons,
  };
}

/* ------------------------------------------------------------------ */
/* Plucking recommendation — WHICH field/part to pluck TODAY          */
/* ------------------------------------------------------------------ */

export interface PluckField {
  id: string;
  name: string;
  division: string;
  cultivar: string;
  areaHa: number;
  daysSinceLastPluck: number;
  cycleDays: number; // target plucking round length
  avgShootLengthCm: number; // growth proxy
  qualityGrade: string;
}

export interface PluckRecommendation {
  field: PluckField;
  priority: "today" | "soon" | "monitor";
  rank: number;
  score: number;
  reasons: string[];
}

/**
 * Determines which field/part of the estate to pluck today for optimal
 * yield & quality, factoring growth cycle and incoming weather.
 * 100% deterministic rules.
 */
export function recommendPlucking(fields: PluckField[], forecast: WeatherDay[]): PluckRecommendation[] {
  const heavyRainSoon = forecast.slice(0, 2).some((d) => d.rainMm >= 35);

  const ranked = fields
    .map((field): PluckRecommendation => {
      const reasons: string[] = [];
      const overdue = field.daysSinceLastPluck - field.cycleDays;
      let score = 0;

      // Cycle maturity
      if (overdue >= 0) {
        score += 42;
        reasons.push(`Round mature: ${field.daysSinceLastPluck}/${field.cycleDays} days since last pluck.`);
      } else {
        score += Math.max(0, 42 + overdue * 4);
        reasons.push(`${Math.abs(overdue)} day(s) before ${field.cycleDays}-day round.`);
      }

      // Shoot growth
      if (field.avgShootLengthCm >= 8) {
        score += 26;
        reasons.push(`Shoot length ${field.avgShootLengthCm}cm — peak coarseness window for ${field.qualityGrade}.`);
      } else if (field.avgShootLengthCm >= 5) {
        score += 16;
        reasons.push(`Shoot length ${field.avgShootLengthCm}cm — acceptable.`);
      } else {
        reasons.push(`Shoots short (${field.avgShootLengthCm}cm) — quality at risk, hold if possible.`);
      }

      // Weather quality factor: pluck BEFORE heavy rain to protect leaf quality
      if (overdue >= -1 && heavyRainSoon) {
        score += 22;
        reasons.push("⚠ Heavy rain within 48h — pluck now to protect leaf quality & avoid flush loss.");
      } else if (!heavyRainSoon) {
        score += 10;
        reasons.push("Dry window ahead — ideal for high-grade plucking.");
      }

      // VP / high-yield cultivar preference
      if (/VP|2025|2023/i.test(field.cultivar)) {
        score += 12;
        reasons.push(`${field.cultivar} clone responds well to tight round length.`);
      }

      const priority: PluckRecommendation["priority"] =
        score >= 70 ? "today" : score >= 50 ? "soon" : "monitor";

      return { field, priority, rank: 0, score: Math.round(score), reasons };
    })
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return ranked;
}

/* ------------------------------------------------------------------ */
/* Weather → actionable alerts (DETERMINISTIC If/Else, not AI)        */
/* ------------------------------------------------------------------ */

export type AlertSeverity = "critical" | "warning" | "info" | "success";

export interface EnvAlert {
  id: string;
  severity: AlertSeverity;
  icon: string;
  title: string;
  detail: string;
  action: string;
}

export function weatherToAlerts(forecast: WeatherDay[]): EnvAlert[] {
  const alerts: EnvAlert[] = [];
  const total7 = forecast.reduce((s, d) => s + d.rainMm, 0);
  const maxDay = forecast.reduce((m, d) => (d.rainMm > m ? d.rainMm : m), 0);
  const hot = forecast.filter((d) => d.tempMax >= 31).length;
  const windy = forecast.filter((d) => d.windKph >= 35).length;

  if (forecast.some((d) => d.rainMm >= 50)) {
    alerts.push({
      id: "flood",
      severity: "critical",
      icon: "CloudRain",
      title: "Heavy downpour imminent",
      detail: `${maxDay}mm in 24h expected. Suspend spraying & fertilizer to prevent leaching/runoff.`,
      action: "Pause agrochemical & fertilizer ops",
    });
  }

  if (total7 < 12 && hot >= 2) {
    alerts.push({
      id: "drought",
      severity: "warning",
      icon: "Sun",
      title: "Dry / heat stress risk",
      detail: `Only ${total7}mm over 7 days with ${hot} hot days (${forecast[0].tempMax}°C+). Monitor soil moisture.`,
      action: "Trigger irrigation & deep mulch",
    });
  }

  if (windy >= 1) {
    alerts.push({
      id: "wind",
      severity: "warning",
      icon: "Wind",
      title: "Spray-drift caution",
      detail: `Wind ≥ 35 km/h on ${windy} day(s). Avoid herbicide/pesticide application.`,
      action: "Re-schedule spray windows",
    });
  }

  const goodPluck = forecast[0] && forecast[0].rainMm <= 12 && forecast[0].rainProb <= 40;
  if (goodPluck) {
    alerts.push({
      id: "pluck",
      severity: "success",
      icon: "Leaf",
      title: "Prime plucking conditions",
      detail: "Low rain probability today — ideal for high-grade Orthodox/BOP leaf capture.",
      action: "Open collection centers early",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "calm",
      severity: "info",
      icon: "CloudSun",
      title: "Conditions nominal",
      detail: "No threshold breaches in the 7-day horizon. Routine operations.",
      action: "Continue scheduled tasks",
    });
  }

  return alerts;
}

/* ------------------------------------------------------------------ */
/* Yield estimation (used by the AI module — deterministic baseline)  */
/* ------------------------------------------------------------------ */

export interface YieldInput {
  cultivar: string;
  ageYears: number;
  rainfallAnnualMm: number;
  fertilizerAdherencePct: number; // 0-100
  pruningPhase: CropStage;
}

export function estimateYieldKgPerHa(input: YieldInput): number {
  // Deterministic baseline model. Real LLM module overlays narrative insights.
  const cloneBase = /VP|2025|2023/i.test(input.cultivar) ? 3200 : 2400;
  const ageFactor =
    input.ageYears < 3 ? 0.4 : input.ageYears < 6 ? 0.8 : input.ageYears <= 40 ? 1 : 0.85;
  const rainFactor =
    input.rainfallAnnualMm < 1400
      ? 0.7
      : input.rainfallAnnualMm > 3200
        ? 0.92
        : 0.85 + (Math.min(input.rainfallAnnualMm, 3000) - 1400) / 11000;
  const fertFactor = 0.55 + (input.fertilizerAdherencePct / 100) * 0.45;
  const pruneFactor = input.pruningPhase === "pruned" ? 0.6 : 1;
  return Math.round(cloneBase * ageFactor * rainFactor * fertFactor * pruneFactor);
}

/* ------------------------------------------------------------------ */
/* B25 FIX — Yield projection from fertilizer inputs                  */
/* ------------------------------------------------------------------ */
/**
 * predictYieldFromFertilizer — compute expected green-leaf yield (kg)
 * over the next `horizonDays` based on the fertilizer applied so far.
 *
 * Uses deterministic TRI response curves:
 *   • Urea (46% N):   1 kg Urea ≈ 6 kg green leaf (vegetative growth boost)
 *   • TSP (P):        1 kg TSP  ≈ 1.5 kg green leaf (root/quality support)
 *   • MOP (K):        1 kg MOP  ≈ 2 kg green leaf (drought tolerance + yield)
 *   • Dolomite:       1 kg      ≈ 0.3 kg (soil pH correction — indirect)
 *   • Compost:        1 kg      ≈ 0.5 kg (slow-release organic)
 *
 * The yield response is bounded by plot acreage × regional max yield so
 * unrealistic fertilizer rates can't produce unrealistic projections.
 *
 * Returned shape: { expectedKg, breakdown, cappedByAcreage, horizonDays }
 */
export interface FertilizerYieldInput {
  acreage: number;
  ureaKg: number;
  tspKg: number;
  mopKg: number;
  dolomiteKg?: number;
  compostKg?: number;
  region?: "low-country" | "mid-country" | "up-country" | "default";
  horizonDays?: number; // default 30
}

export interface FertilizerYieldResult {
  expectedKg: number;
  breakdown: { source: string; kg: number }[];
  cappedByAcreage: boolean;
  horizonDays: number;
}

const YIELD_PER_REGION_PER_ACRE_MONTH: Record<string, number> = {
  "low-country": 125,   // ~1500 kg/acre/year ÷ 12
  "mid-country": 92,    // ~1100 ÷ 12
  "up-country": 67,     // ~800 ÷ 12
  "default": 100,
};

export function predictYieldFromFertilizer(input: FertilizerYieldInput): FertilizerYieldResult {
  const horizonDays = input.horizonDays ?? 30;
  const horizonMonths = horizonDays / 30;

  // 1. Sum the leaf-equivalent response from each fertilizer type.
  const ureaResp = input.ureaKg * 6;
  const tspResp = input.tspKg * 1.5;
  const mopResp = input.mopKg * 2;
  const dolomiteResp = (input.dolomiteKg ?? 0) * 0.3;
  const compostResp = (input.compostKg ?? 0) * 0.5;
  const rawTotal = ureaResp + tspResp + mopResp + dolomiteResp + compostResp;

  // 2. Scale by horizon (the response curve is roughly linear over 30 days,
  //    diminishing thereafter — so we cap the multiplier at 2.5× for 90 days).
  const horizonMultiplier = Math.min(2.5, horizonMonths);
  const horizonScaledKg = Math.round(rawTotal * horizonMultiplier);

  // 3. Cap by the plot's acreage × regional max yield per acre per month.
  const maxYieldPerMonth = (input.acreage || 0) * (YIELD_PER_REGION_PER_ACRE_MONTH[input.region ?? "default"] ?? YIELD_PER_REGION_PER_ACRE_MONTH.default);
  const maxKg = Math.round(maxYieldPerMonth * horizonMonths);
  const cappedByAcreage = horizonScaledKg > maxKg && maxKg > 0;
  const expectedKg = cappedByAcreage ? maxKg : horizonScaledKg;

  return {
    expectedKg,
    breakdown: [
      { source: "Urea (46% N)", kg: Math.round(ureaResp * horizonMultiplier) },
      { source: "TSP (Phosphate)", kg: Math.round(tspResp * horizonMultiplier) },
      { source: "MOP (Potash)", kg: Math.round(mopResp * horizonMultiplier) },
      { source: "Dolomite", kg: Math.round(dolomiteResp * horizonMultiplier) },
      { source: "Compost", kg: Math.round(compostResp * horizonMultiplier) },
    ],
    cappedByAcreage,
    horizonDays,
  };
}

/* ------------------------------------------------------------------ */
/* B28 FIX — Admin supply projection from pruning                    */
/* ------------------------------------------------------------------ */
/**
 * projectLeafSupplyAfterPruning — compute the projected drop in leaf
 * supply after a pruning event, based on deterministic TRI recovery curves.
 *
 * Tea bushes undergo a yield trough after a structural prune:
 *   • Deep prune (cut-across): ~30% drop, trough starts ~60d after prune,
 *     lasts ~90 days (full recovery at ~12 months).
 *   • Medium prune: ~20% drop, trough 45d, recovery ~9 months.
 *   • Light prune / skiffing: ~10% drop, trough 30d, recovery ~6 months.
 *
 * Returns a projection that admin can use to plan factory intake.
 *
 * Returned shape: { expectedDropPct, troughStartDays, troughEndDays,
 *                   recoveryDays, headline, detail }
 */
export interface PruningProjectionInput {
  pruneType: "light" | "medium" | "deep" | "skiffing" | "formative";
  daysSincePrune: number;
  areaHa?: number;
  baselineYieldKgPerMonth?: number;
}

export interface PruningProjectionResult {
  expectedDropPct: number;
  troughStartDays: number;
  troughEndDays: number;
  recoveryDays: number;
  currentDropPct: number;        // current drop based on daysSincePrune
  projectedLostKgThisMonth: number;
  headline: string;
  detail: string;
}

export function projectLeafSupplyAfterPruning(input: PruningProjectionInput): PruningProjectionResult {
  const table: Record<PruningProjectionInput["pruneType"], Omit<PruningProjectionResult, "currentDropPct" | "projectedLostKgThisMonth">> = {
    deep:      { expectedDropPct: 30, troughStartDays: 60, troughEndDays: 150, recoveryDays: 365, headline: "Deep prune — 30% yield drop expected", detail: "Bushes recover slowly after a structural cut-across. Trough at 60-150 days; full recovery at ~12 months. Plan reduced factory intake from this block." },
    medium:    { expectedDropPct: 20, troughStartDays: 45, troughEndDays: 105, recoveryDays: 270, headline: "Medium prune — 20% yield drop expected", detail: "Medium structural prune. Trough at 45-105 days; recovery at ~9 months. Slightly reduced intake for one season." },
    light:     { expectedDropPct: 10, troughStartDays: 30, troughEndDays: 75,  recoveryDays: 180, headline: "Light prune — 10% yield drop expected", detail: "Light prune / skiff. Trough at 30-75 days; recovery at ~6 months. Minor intake reduction." },
    skiffing:  { expectedDropPct: 8,  troughStartDays: 21, troughEndDays: 60,  recoveryDays: 150, headline: "Skiffing — 8% yield drop expected", detail: "Light skiff for surface leveling. Trough at 21-60 days; recovery at ~5 months." },
    formative: { expectedDropPct: 0,  troughStartDays: 0,  troughEndDays: 0,   recoveryDays: 0,   headline: "Formative prune — no yield impact", detail: "Formative prune on young bushes. No yield drop (bushes weren't plucking yet)." },
  };
  const base = table[input.pruneType] ?? table.light;

  // Compute current drop based on where we are in the recovery curve.
  let currentDropPct = 0;
  if (base.expectedDropPct > 0) {
    if (input.daysSincePrune < base.troughStartDays) {
      // Ramping into trough — linear ramp from 0 to expectedDropPct.
      currentDropPct = (input.daysSincePrune / base.troughStartDays) * base.expectedDropPct;
    } else if (input.daysSincePrune <= base.troughEndDays) {
      // Inside the trough.
      currentDropPct = base.expectedDropPct;
    } else if (input.daysSincePrune < base.recoveryDays) {
      // Recovery phase — linear ramp from expectedDropPct to 0.
      const recoveryFraction = (input.daysSincePrune - base.troughEndDays) / (base.recoveryDays - base.troughEndDays);
      currentDropPct = base.expectedDropPct * (1 - recoveryFraction);
    } else {
      // Fully recovered.
      currentDropPct = 0;
    }
  }
  currentDropPct = Math.max(0, Math.round(currentDropPct * 10) / 10);

  const baselineMonthlyKg = input.baselineYieldKgPerMonth ?? ((input.areaHa ?? 0) * 1000); // ~1000 kg/ha/month default
  const projectedLostKgThisMonth = Math.round(baselineMonthlyKg * (currentDropPct / 100));

  return {
    ...base,
    currentDropPct,
    projectedLostKgThisMonth,
  };
}

/* ------------------------------------------------------------------ */
/* SMART AGRONOMIC ADVISORY & PRUNING SCHEDULE                        */
/* ------------------------------------------------------------------ */
/* Deterministic tea-plant age + pruning-cycle engine.
 * Based on Sri Lankan up-country (TRI) pruning cycles:
 *   • 0–1 yr  : Nursery / planted — no prune, tipping only.
 *   • 1–3 yrs : Formative pruning (shape the bush / bring into plucking).
 *   • 3–4 yrs : First light/medium prune.
 *   • 4–40 yrs: Deep "cut-across" / structural prune every ~3-4 yrs.
 *   • >40 yrs : Replanting recommended (bush senescence).
 * 100% deterministic If/Else — no AI.
 */

export type PruneType =
  | "none"
  | "tipping"
  | "formative"
  | "light"
  | "medium"
  | "deep"
  | "replant";

export interface PlantAge {
  years: number;
  months: number; // total months since planted
  totalDays: number;
  display: string; // e.g. "3 years, 4 months"
}

export interface PruningAdvice {
  age: PlantAge;
  /** Which prune the plants are currently in the window for. */
  currentCycle: PruneType;
  /** Human-readable headline recommendation. */
  headline: string;
  /** Detailed deterministic advice. */
  detail: string;
  /** Next sensible date to perform the action (ISO yyyy-mm-dd). */
  nextDate: string;
  /** Severity for UI theming. */
  level: AdviceLevel;
  /** True if peak-yield age (4–15 yrs plucking prime). */
  isPeakYield: boolean;
}

/** Compute plant age from a planted date → today. */
export function computePlantAge(plantedDateIso: string, todayIso: string): PlantAge {
  const planted = new Date(plantedDateIso);
  const today = new Date(todayIso);
  const totalDays = Math.max(0, Math.round((today.getTime() - planted.getTime()) / MS_PER_DAY));
  const totalMonths = Math.floor(totalDays / 30.4375);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const display =
    years <= 0
      ? `${months} month${months === 1 ? "" : "s"}`
      : `${years} year${years === 1 ? "" : "s"}${months ? `, ${months} month${months === 1 ? "" : "s"}` : ""}`;
  return { years, months, totalDays, display };
}

/**
 * Generate the pruning schedule recommendation from a planted date.
 * `todayIso` injected for deterministic testing.
 */
export function recommendPruning(plantedDateIso: string, todayIso: string): PruningAdvice {
  const age = computePlantAge(plantedDateIso, todayIso);

  // The up-country convention: prune during the dry "quality" season.
  // We schedule the NEXT prune to the upcoming January (deterministic window).
  const nextPruneYear = new Date(todayIso).getMonth() > 8 ? new Date(todayIso).getFullYear() + 1 : new Date(todayIso).getFullYear();
  const nextDate = `${nextPruneYear}-01-15`;

  // Branch purely on plant age.
  let currentCycle: PruneType;
  let headline: string;
  let detail: string;
  let level: AdviceLevel;

  if (age.years < 1) {
    currentCycle = "tipping";
    level = "info";
    headline = "Tipping Stage — Bush Establishment";
    detail = `Plants are ${age.display} old (nursery/young). Continue light tipping to encourage lateral branching. No structural pruning yet — let the frame develop.`;
  } else if (age.years < 3) {
    currentCycle = "formative";
    level = "optimal";
    headline = "Formative Pruning Window";
    detail = `Plants are ${age.display} old. Perform formative pruning to shape the bush and bring it into the plucking table. Tip regularly after the prune to build canopy.`;
  } else if (age.years < 5) {
    currentCycle = "light";
    level = "due";
    headline = "First Light/Medium Prune Due";
    detail = `Plants are ${age.display} old and entering mature plucking. A light-to-medium prune restores plucking density and removes dead wood.`;
  } else if (age.years <= 40) {
    // Mature bushes: deep structural prune every ~3-4 years.
    // Determine if we're in a prune year (year mod 4 == 0 from planting).
    const inPruneYear = age.years % 4 === 0 || age.years % 4 === 1;
    currentCycle = "deep";
    level = inPruneYear ? "due" : "optimal";
    headline = inPruneYear ? "Deep (Cut-Across) Prune Cycle" : "Mature Plucking — Maintain";
    detail = inPruneYear
      ? `Plants are ${age.display} old — due for a deep structural prune this cycle to rejuvenate the bush and sustain yield. Schedule during the dry quality season.`
      : `Plants are ${age.display} old and in their prime plucking phase. Continue skiffing & light maintenance; the next deep prune falls on a 4-year cycle.`;
  } else {
    currentCycle = "replant";
    level = "critical";
    headline = "⚠ Replanting Recommended";
    detail = `Plants are ${age.display} old — well past economic yield age (40+ yrs). Senescent bushes yield poorly. Plan a replanting programme with VP clones (TRI 2025/2023).`;
    // Replanting is a longer horizon; suggest next year.
    level = "critical";
  }

  const isPeakYield = age.years >= 4 && age.years <= 15;

  return { age, currentCycle, headline, detail, nextDate, level, isPeakYield };
}

/**
 * Weather-based fertilizer trigger layered on top of plant age.
 * Young plants (<3 yrs) need more frequent feeding; mature plants less.
 * Returns a short actionable message (deterministic).
 */
export function ageBasedFertilizerTrigger(age: PlantAge, forecast: WeatherDay[], _todayIso: string): string {
  const heavyRain = forecast.slice(0, 3).some((d) => d.rainMm >= 35);
  const dryWindow = forecast[0] && forecast[0].rainMm <= 8;
  const intervalMonths = age.years < 3 ? 2 : age.years <= 10 ? 3 : 4;

  if (heavyRain) {
    return `⚠ Heavy rain in the next 3 days — pause fertilizer for ${age.years < 3 ? "young" : "mature"} bushes to avoid leaching. Reapply after the system clears (≈${intervalMonths}-month cadence for this age).`;
  }
  if (dryWindow) {
    return `Dry window open today — ideal to apply the next ${intervalMonths}-monthly feed for your ${age.display}-old plants. Light irrigation after spreading activates nutrients.`;
  }
  return `Continue the ${intervalMonths}-monthly fertilizer cadence for ${age.display}-old plants. Avoid spreading during the forecast showers.`;
}
