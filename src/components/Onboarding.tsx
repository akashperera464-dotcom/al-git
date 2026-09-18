import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Home, Sprout, Trees, BellRing, ChevronRight, X, Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";
import { useApp } from "@/context/AppContext";

/**
 * Onboarding — first-time-user walkthrough shown to suppliers on their
 * initial login (B5 fix). 4-step stepper that introduces the key modules:
 *   1. Home dashboard
 *   2. My Farm Activities (log fertilizer / pruning / plucking)
 *   3. My Plot (registration + blocks)
 *   4. Smart Alerts (FCM push)
 *
 * Persisted via localStorage key `kdu.onboarding_completed.{userUid}` so it
 * only shows ONCE per supplier. A "Skip" link is always available.
 */
const ONBOARDING_KEY = (uid: string) => `kdu.onboarding_completed.${uid}`;

export function Onboarding() {
  const { t } = useTranslation();
  const { userUid, setActiveModule, role } = useApp();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Only show to suppliers, and only if they haven't completed onboarding yet.
  if (role !== "supplier" || dismissed) return null;
  try {
    if (localStorage.getItem(ONBOARDING_KEY(userUid))) return null;
  } catch { /* ignore */ }

  const STEPS = [
    {
      icon: Home,
      tone: "from-emerald-500 to-teal-600",
      title: t("onboarding.step1Title") || "Welcome to Your Supplier Portal",
      body: t("onboarding.step1Body") || "This is your home dashboard. See today's weather, total supplied kg, earnings, and quick actions at a glance.",
      cta: t("onboarding.step1Cta") || "Open Home",
      module: "supplier-home",
    },
    {
      icon: Sprout,
      tone: "from-amber-500 to-orange-600",
      title: t("onboarding.step2Title") || "Log Your Farm Activities",
      body: t("onboarding.step2Body") || "Record every fertilizer application, pruning, and plucking round. The smart advisory engine reads these to recommend your next steps.",
      cta: t("onboarding.step2Cta") || "Open Farm Activities",
      module: "supplier-farm",
    },
    {
      icon: Trees,
      tone: "from-sky-500 to-blue-700",
      title: t("onboarding.step3Title") || "Register Your Plot",
      body: t("onboarding.step3Body") || "Enter your plot details (acreage, bush count, GPS, photos) and divide it into blocks. Admin will approve, then your data auto-fills everywhere.",
      cta: t("onboarding.step3Cta") || "Open My Plot",
      module: "supplier-plot",
    },
    {
      icon: BellRing,
      tone: "from-violet-500 to-fuchsia-600",
      title: t("onboarding.step4Title") || "Get Smart Alerts via Push",
      body: t("onboarding.step4Body") || "Fertilizer cycle due, pruning mixture reminder, weather guard — we send FCM pushes to your phone even when the app is closed.",
      cta: t("onboarding.step4Cta") || "Open Smart Alerts",
      module: "supplier-alerts",
    },
  ];

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    try { localStorage.setItem(ONBOARDING_KEY(userUid), new Date().toISOString()); } catch { /* ignore */ }
    setDismissed(true);
  };

  const goNext = () => {
    if (isLast) {
      finish();
    } else {
      setStep(s => s + 1);
    }
  };

  const openModule = () => {
    setActiveModule(current.module);
    if (isLast) finish();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 backdrop-blur-sm animate-fade-in p-3">
      <div className="safe-bottom safe-x relative w-full max-w-md animate-fade-up rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Skip button */}
        <button
          onClick={finish}
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          title={t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Hero icon banner */}
        <div className={cn("bg-gradient-to-br p-6 text-white", current.tone)}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-80">
            <Sparkles className="h-3.5 w-3.5" />
            {t("onboarding.eyebrow") || "Quick Tour"} · {step + 1}/{STEPS.length}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <Icon className="h-7 w-7" />
            </span>
            <h2 className="font-display text-lg font-bold leading-tight">{current.title}</h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{current.body}</p>

          {/* Progress dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6 bg-emerald-500" : i < step ? "w-1.5 bg-emerald-300" : "w-1.5 bg-slate-200"
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={openModule}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {current.cta}
            </button>
            <button
              onClick={goNext}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:brightness-110"
            >
              {isLast ? (t("onboarding.finish") || "Finish") : (t("onboarding.next") || "Next")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Skip link */}
          <button
            onClick={finish}
            className="mt-3 w-full text-center text-[11px] font-medium text-slate-400 hover:text-slate-600"
          >
            {t("onboarding.skip") || "Skip tour — I'll explore myself"}
          </button>
        </div>
      </div>
    </div>
  );
}
