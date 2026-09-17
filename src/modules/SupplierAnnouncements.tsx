import { useEffect, useState } from "react";
import { Newspaper, CalendarDays, Tag, Check, CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, Card, Badge, IconChip } from "@/components/ui";
import { useLiveData } from "@/lib/useLiveData";
import { crudRead } from "@/lib/repo";
import { isMediaUrl } from "@/lib/branding";
import { useBranding } from "@/lib/branding";
import { useApp } from "@/context/AppContext";

interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  category: string;
  published: boolean;
  created_at?: string;
  publishedAt?: string;
}

const READ_KEY = (userUid: string) => `kdu.announcements.read.${userUid}`;

/** Supplier · Estate Updates — real-time feed of admin-published articles.
 * NEW (Sir's spec): "Mark as Read" tracking + sort latest first. */
export function SupplierAnnouncements() {
  const { t } = useTranslation();
  const { branding } = useBranding();
  const { userUid } = useApp();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Load read IDs from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_KEY(userUid));
      if (raw) setReadIds(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, [userUid]);

  const { data: posts, loading } = useLiveData<Announcement>("announcements", async () => {
    const rows = await crudRead<Record<string, unknown>>("announcements");
    return rows
      .filter((r) => r.published)
      .map((r) => ({
        id: r.id as string,
        title: r.title as string,
        body: r.body as string,
        imageUrl: r.image_url as string,
        category: r.category as string,
        published: Boolean(r.published),
        created_at: r.created_at as string | undefined,
        publishedAt: r.published_at as string | undefined,
      }))
      // NEW: sort latest first (created_at desc, fall back to id for tiebreak)
      .sort((a, b) => {
        const aDate = a.publishedAt || a.created_at || "";
        const bDate = b.publishedAt || b.created_at || "";
        return bDate.localeCompare(aDate);
      });
  });

  const markAsRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(READ_KEY(userUid), JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const markAllAsRead = () => {
    const all = new Set(posts.map(p => p.id));
    setReadIds(all);
    try { localStorage.setItem(READ_KEY(userUid), JSON.stringify([...all])); } catch { /* ignore */ }
  };

  const unreadCount = posts.filter(p => !readIds.has(p.id)).length;

  return (
    <div>
      <PageHeader
        eyebrow={t("announcements.eyebrow")}
        title={t("announcements.title")}
        desc={t("announcements.desc")}
        icon={<IconChip icon={Newspaper} tone="sky" className="h-12 w-12" />}
        actions={
          unreadCount > 0 ? (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all as read ({unreadCount})
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-slate-400">{t("announcements.loading")}</Card>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center">
          <Newspaper className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">{t("announcements.noUpdates")}</p>
        </Card>
      ) : (
        <>
          {/* Unread badge */}
          {unreadCount > 0 && (
            <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
              <span className="font-semibold">{unreadCount}</span> unread announcement{unreadCount !== 1 ? "s" : ""}
            </div>
          )}
          <div className="space-y-4">
            {posts.map((post) => {
              const hasImage = post.imageUrl && isMediaUrl(post.imageUrl);
              const isRead = readIds.has(post.id);
              return (
                <Card key={post.id} className={`overflow-hidden card-hover ${isRead ? "opacity-70" : "ring-1 ring-sky-200"}`}>
                  {/* Image (if provided) */}
                  {hasImage && (
                    <div className="aspect-video w-full overflow-hidden bg-slate-100">
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge tone="sky"><Tag className="mr-1 h-3 w-3" />{post.category}</Badge>
                      {!isRead && <Badge tone="emerald" dot>NEW</Badge>}
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-900">{post.title}</h3>

                    {/* Body — render with line breaks */}
                    <div className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                      {post.body}
                    </div>

                    {/* Footer */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{t("announcements.publishedBy", { name: branding.companyName || t("announcements.defaultAdmin") })}</span>
                      </div>
                      {!isRead ? (
                        <button
                          onClick={() => markAsRead(post.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          <Check className="h-3 w-3" /> Mark as read
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                          <Check className="h-3 w-3" /> Read
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
