import { Smartphone, Wifi, WifiOff, RefreshCw, Database, BellRing, Cpu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, StatCard, Panel, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";

const SW_CODE = `// public/sw.ts — Workbox-powered offline shell
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { Queue } from "workbox-background-sync";

precacheAndRoute(self.__WB_MANIFEST || []);

// Firestore-style write queue (flushed on reconnect)
export const writeQueue = new Queue("verda-mutations");

registerRoute(/\/api\/(harvest|attendance|fertilizer)/,
  new NetworkFirst({ cacheName: "verda-api" }), "GET");

self.addEventListener("sync", (e) => {
  if (e.tag === "flush-queue") e.waitUntil(writeQueue.replayRequests());
});`;

const MANIFEST_CODE = `// public/manifest.json
{
  "name": "KDU TEA FACTORY · Tea Estate ERP",
  "short_name": "KDU",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#04231a",
  "theme_color": "#064e3b",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ]
}`;

export default function MobileOffline() {
  const { t } = useTranslation();
  const { online, toggleOnline, syncQueue, flushSync } = useApp();
  const queued = syncQueue.filter((q) => q.status === "queued").length;

  return (
    <div>
      <PageHeader
        eyebrow={t("mobile.eyebrow")}
        title={t("mobile.title")}
        desc={t("mobile.desc")}
        icon={<IconChip icon={Smartphone} tone="emerald" className="h-12 w-12" />}
        actions={
          <button
            onClick={toggleOnline}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${online ? "bg-emerald-600" : "bg-slate-600"}`}
          >
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {online ? t("mobile.online") : t("mobile.offline")}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={online ? Wifi : WifiOff} label={t("mobile.network")} value={online ? t("mobile.online") : t("mobile.offline")} sub={online ? t("mobile.liveSyncActive") : t("mobile.indexeddbBuffering")} tone={online ? "emerald" : "rose"} />
        <StatCard icon={Database} label={t("mobile.pendingQueue")} value={String(queued)} sub={t("mobile.unsyncedMutations")} tone="amber" />
        <StatCard icon={RefreshCw} label={t("mobile.conflictPolicy")} value={t("mobile.lastWrite")} sub={t("mobile.fieldWinsMerge")} tone="sky" />
        <StatCard icon={BellRing} label={t("mobile.fcmToken")} value={t("mobile.registered")} sub={t("mobile.freePushChannel")} tone="violet" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1" title={t("mobile.syncQueue")} subtitle={t("mobile.liveIndexeddbBuffer")} icon={<IconChip icon={Database} tone="amber" className="h-9 w-9" />} action={queued > 0 ? <button onClick={flushSync} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"><RefreshCw className="h-3 w-3" /> {t("mobile.flush")}</button> : <Badge tone="emerald" dot>{t("common.synced")}</Badge>}>
          <div className="space-y-2">
            {syncQueue.length === 0 && <p className="py-6 text-center text-sm text-slate-400">{t("mobile.queueEmpty")}</p>}
            {syncQueue.map((q) => (
              <div key={q.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5">
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${q.status === "queued" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                  {q.status === "queued" ? <WifiOff className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-700">{q.label}</p>
                  <p className="text-[10px] text-slate-400">{q.time}</p>
                </div>
                <Badge tone={q.status === "queued" ? "amber" : "emerald"}>{q.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title={t("mobile.serviceWorkerConfig")} subtitle="public/sw.ts" icon={<IconChip icon={Cpu} tone="emerald" className="h-9 w-9" />}>
          <pre className="overflow-x-auto rounded-xl bg-[#04231a] p-4 text-[11px] leading-relaxed text-emerald-200 no-scrollbar"><code>{SW_CODE}</code></pre>
        </Panel>

        <Panel className="lg:col-span-3" title={t("mobile.pwaManifest")} subtitle="public/manifest.json" icon={<IconChip icon={Smartphone} tone="violet" className="h-9 w-9" />}>
          <pre className="overflow-x-auto rounded-xl bg-[#04231a] p-4 text-[11px] leading-relaxed text-emerald-200 no-scrollbar"><code>{MANIFEST_CODE}</code></pre>
        </Panel>
      </div>
    </div>
  );
}
