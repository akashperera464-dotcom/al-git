import { getSupabase, supabaseConfigured } from "./supabase";

export const AI_ADVISORY_DISTANCE_KM = 1.5;

export interface ProximityAdvisoryInput {
  routeId: string;
  estateId: string;
  distanceKm: number;
  etaMinutes: number;
  language: "en" | "si" | "ta";
}

export interface ProximityAdvisory {
  advice: string;
  source: "openrouter" | "fallback";
  generatedAt: string;
}

export function shouldRequestProximityAdvisory(distanceKm: number): boolean {
  return Number.isFinite(distanceKm) && distanceKm >= 0 && distanceKm < AI_ADVISORY_DISTANCE_KM;
}

export function fallbackProximityAdvisory(language: ProximityAdvisoryInput["language"], etaMinutes: number): string {
  if (language === "si") return `ලොරිය විනාඩි ${etaMinutes}කින් පමණ පැමිණේ. දලු මලු පිරිසිදුව සූදානම් කර, තෙතමනය හා සෘජු හිරු එළියෙන් ආරක්ෂා කර, එකතු කිරීමේ ස්ථානයට ආරක්ෂිතව රැගෙන එන්න.`;
  if (language === "ta") return `லாரி சுமார் ${etaMinutes} நிமிடங்களில் வரும். தேயிலைப் பைகளைச் சுத்தமாகத் தயார் செய்து, ஈரப்பதம் மற்றும் நேரடி வெயிலிலிருந்து பாதுகாத்து, சேகரிப்பு இடத்துக்கு பாதுகாப்பாக கொண்டு வாருங்கள்.`;
  return `The lorry should arrive in about ${etaMinutes} minutes. Prepare clean leaf bags, protect the leaves from moisture and direct sun, and move them safely to the collection point.`;
}

export async function requestProximityAdvisory(input: ProximityAdvisoryInput): Promise<ProximityAdvisory> {
  if (!supabaseConfigured) return { advice: fallbackProximityAdvisory(input.language, input.etaMinutes), source: "fallback", generatedAt: new Date().toISOString() };
  try {
    const { data, error } = await getSupabase()!.functions.invoke("openrouter-advisory", { body: input });
    if (error || typeof data?.advice !== "string" || !data.advice.trim()) throw new Error(error?.message ?? "AI advisory unavailable");
    return { advice: data.advice.trim(), source: "openrouter", generatedAt: data.generatedAt ?? new Date().toISOString() };
  } catch {
    return { advice: fallbackProximityAdvisory(input.language, input.etaMinutes), source: "fallback", generatedAt: new Date().toISOString() };
  }
}
