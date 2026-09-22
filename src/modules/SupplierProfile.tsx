import { useEffect, useState } from "react";
import { User, Save, Bell, Info } from "lucide-react";
import { PageHeader, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";

/**
 * SupplierProfile — "My Profile" module (supplier side)
 * ------------------------------------------------------------------
 * Combines:
 *   A2 — Profile/Settings page (edit name, phone, NIC, address, photo)
 *   A3 — Notification Center (persistent notification list from localStorage)
 *
 * Also includes notification preferences (C.13 from earlier spec).
 *
 * EMS NOTE: Cost-vs-Earnings Summary (A8) was REMOVED — the factory handles
 * supplier leaf payments externally via a separate finance system, so
 * earnings/payment figures no longer appear in the supplier portal.
 */
const PROFILE_KEY = (uid: string) => `kdu.supplier_profile.${uid}`;
const NOTIFS_KEY = (uid: string) => `kdu.supplier_notifications.${uid}`;

interface StoredNotification {
  id: string;
  title: string;
  body: string;
  tone: string;
  channel: string;
  timestamp: number;
  read: boolean;
}

interface ProfileData {
  name: string;
  phone: string;
  nic: string;
  address: string;
  emergencyContact: string;
  photoUrl: string;
  notificationPrefs: {
    requestAlerts: boolean;
    announcementAlerts: boolean;
    weatherAlerts: boolean;
    advisoryAlerts: boolean;
  };
}

const DEFAULT_PROFILE: ProfileData = {
  name: "",
  phone: "",
  nic: "",
  address: "",
  emergencyContact: "",
  photoUrl: "",
  notificationPrefs: {
    requestAlerts: true,
    announcementAlerts: true,
    weatherAlerts: true,
    advisoryAlerts: true,
  },
};

export function SupplierProfile() {
  const { userUid, user, notify } = useApp();
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [editing, setEditing] = useState(false);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);

  useEffect(() => {
    // Load profile
    try {
      const raw = localStorage.getItem(PROFILE_KEY(userUid));
      if (raw) {
        setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) });
      } else if (user?.name) {
        setProfile({ ...DEFAULT_PROFILE, name: user.name });
      }
    } catch { /* ignore */ }

    // Load notifications (from toast history — we also listen for new toasts)
    try {
      const raw = localStorage.getItem(NOTIFS_KEY(userUid));
      if (raw) setNotifications(JSON.parse(raw));
    } catch { /* ignore */ }

    // Listen for new toasts and persist them
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const newNotif: StoredNotification = {
        id: `n-${Date.now()}`,
        title: detail.title || "",
        body: detail.body || "",
        tone: detail.tone || "sky",
        channel: detail.channel || "system",
        timestamp: Date.now(),
        read: false,
      };
      setNotifications(prev => {
        const next = [newNotif, ...prev].slice(0, 50);
        try { localStorage.setItem(NOTIFS_KEY(userUid), JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    };
    window.addEventListener("verda:toast", handleToast);

    return () => window.removeEventListener("verda:toast", handleToast);
  }, [userUid, user?.name]);

  const saveProfile = () => {
    try {
      localStorage.setItem(PROFILE_KEY(userUid), JSON.stringify(profile));
      setEditing(false);
      notify({ title: "Profile saved ✅", body: "Your profile details have been updated.", tone: "emerald", channel: "system" });
    } catch { /* ignore */ }
  };

  const markNotifRead = (id: string) => {
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      try { localStorage.setItem(NOTIFS_KEY(userUid), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const markAllRead = () => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      try { localStorage.setItem(NOTIFS_KEY(userUid), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div>
      <PageHeader
        eyebrow="VVIP Supplier Portal"
        title="My Profile"
        desc="Manage your profile details, notification preferences, and view your notification history."
        icon={<IconChip icon={User} tone="violet" className="h-12 w-12" />}
      />

      {/* A2: Profile details */}
      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-800">👤 පෞද්ගලික තොරතුරු · Profile Details</h3>
          <button onClick={() => setEditing(!editing)} className="text-xs font-semibold text-emerald-600 hover:underline">
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">👤 නම · Name</label>
                <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">📞 දුරකථන · Phone</label>
                <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+94 77 123 4567" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">🆔 ජාතික හැඳුනුම්පත · NIC</label>
                <input value={profile.nic} onChange={e => setProfile({ ...profile, nic: e.target.value })} placeholder="e.g., 851234567V" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">🚨 හදිසි ආරක්ෂක · Emergency Contact</label>
                <input value={profile.emergencyContact} onChange={e => setProfile({ ...profile, emergencyContact: e.target.value })} placeholder="Name + phone" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">📍 ලිපිනය · Address</label>
              <textarea value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">📷 ඡායාරූප URL · Photo URL</label>
              <input value={profile.photoUrl} onChange={e => setProfile({ ...profile, photoUrl: e.target.value })} placeholder="URL to your photo" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <button onClick={saveProfile} className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:brightness-110 inline-flex items-center justify-center gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save Profile
            </button>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[11px] text-slate-400">👤 Name</dt><dd className="font-semibold text-slate-800">{profile.name || user?.name || "—"}</dd></div>
            <div><dt className="text-[11px] text-slate-400">📞 Phone</dt><dd className="font-semibold text-slate-800">{profile.phone || "—"}</dd></div>
            <div><dt className="text-[11px] text-slate-400">🆔 NIC</dt><dd className="font-semibold text-slate-800">{profile.nic || "—"}</dd></div>
            <div><dt className="text-[11px] text-slate-400">🚨 Emergency</dt><dd className="font-semibold text-slate-800">{profile.emergencyContact || "—"}</dd></div>
            <div className="col-span-2"><dt className="text-[11px] text-slate-400">📍 Address</dt><dd className="font-semibold text-slate-800">{profile.address || "—"}</dd></div>
          </dl>
        )}
      </Card>

      {/* C.13: Notification Preferences */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Bell className="h-4 w-4 text-violet-600" /> දැනුම්දීම් අභිරුචි · Notification Preferences
        </h3>
        <div className="space-y-2">
          {([
            { key: "requestAlerts", label: "📥 Request Alerts", desc: "Resource/equipment request status" },
            { key: "announcementAlerts", label: "📢 Announcement Alerts", desc: "Estate updates + news" },
            { key: "weatherAlerts", label: "🌦️ Weather Alerts", desc: "Rain warnings + weather guard" },
            { key: "advisoryAlerts", label: "🤖 Advisory Alerts", desc: "Fertilizer cycle + pruning reminders" },
          ] as const).map(pref => (
            <label key={pref.key} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 cursor-pointer hover:bg-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-700">{pref.label}</p>
                <p className="text-[10px] text-slate-400">{pref.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={profile.notificationPrefs[pref.key]}
                onChange={e => {
                  const next = { ...profile, notificationPrefs: { ...profile.notificationPrefs, [pref.key]: e.target.checked } };
                  setProfile(next);
                  try { localStorage.setItem(PROFILE_KEY(userUid), JSON.stringify(next)); } catch { /* ignore */ }
                }}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>
          ))}
        </div>
      </Card>

      {/* A3: Notification Center */}
      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Bell className="h-4 w-4 text-sky-600" /> දැනුම්දීම් මධ්‍යස්ථානය · Notification Center
            {unreadCount > 0 && <Badge tone="rose" dot>{unreadCount} new</Badge>}
          </h3>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs font-semibold text-emerald-600 hover:underline">
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No notifications yet. You'll see request updates, weather alerts, and announcements here.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`rounded-lg border p-2.5 ${n.read ? "border-slate-100 opacity-60" : "border-sky-200 bg-sky-50"}`}
                onClick={() => !n.read && markNotifRead(n.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{n.body}</p>
                  </div>
                  {!n.read && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">NEW</span>}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">{new Date(n.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* A5: Help/Tutorial */}
      <Card className="mt-4 p-4 border-violet-200 bg-violet-50">
        <h3 className="mb-2 font-display text-sm font-bold text-violet-800 flex items-center gap-1.5">
          <Info className="h-4 w-4" /> උදව් · How to Use This App
        </h3>
        <ul className="space-y-1 text-xs text-violet-700">
          <li>📊 <strong>My Leaf Deliveries</strong> — ඔබගේ කොළ භාරදීම් පෙන්වයි (your leaf deliveries)</li>
          <li>🔔 <strong>Smart Alerts</strong> — පොහොර/කප්පාදු උපදෙස් + කාලගුණ අනතුරු ඇඟවීම් (fertilizer + weather alerts)</li>
          <li>🌾 <strong>My Farm Activities</strong> — පොහොර, කප්පාදු, දලු කඩදීම, නැවත සිටුවීම සටහන් කරන්න (log activities)</li>
          <li>🌳 <strong>My Plot</strong> — වත්ත ලියාපදිංචි කරන්න + GPS + අක්කර/ගස් ගණන (register your plot)</li>
          <li>☁️ <strong>My Weather</strong> — ඔබගේ වත්තේ කාලගුණය (weather for your plot)</li>
          <li>💡 <strong>Tips & Guidance</strong> — දිනපතා කෘෂිකර්ම උපදෙස් (daily agronomy tips)</li>
          <li>🌱 <strong>My Fertilizer</strong> — කම්හලෙන් ලැබූ පොහොර ඉතිරිය (fertilizer balance)</li>
          <li>📰 <strong>Estate Updates</strong> — නිවේදන කියවන්න (read announcements)</li>
          <li>📥 <strong>Request Resources</strong> — උපකරණ/පොහොර ඉල්ලන්න (request resources)</li>
        </ul>
      </Card>
    </div>
  );
}
