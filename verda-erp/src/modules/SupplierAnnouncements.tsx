import { Newspaper, CalendarDays, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, Card, Badge, IconChip } from "@/components/ui";
import { useLiveData } from "@/lib/useLiveData";
import { crudRead } from "@/lib/repo";
import { isMediaUrl } from "@/lib/branding";
import { useBranding } from "@/lib/branding";

interface Announcement { id: string; title: string; body: string; imageUrl: string; category: string; published: boolean; }

/** Supplier · Estate Updates — real-time feed of admin-published articles. */
export function SupplierAnnouncements() {
  const { t } = useTranslation();
  const { branding } = useBranding();
  const { data: posts, loading } = useLiveData<Announcement>("announcements", async () => {
    const rows = await crudRead<Record<string, unknown>>("announcements");
    return rows.filter((r) => r.published).map((r) => ({
      id: r.id as string, title: r.title as string, body: r.body as string,
      imageUrl: r.image_url as string, category: r.category as string,
      published: Boolean(r.published),
    }));
  });

  return (
    <div>
      <PageHeader
        eyebrow={t("announcements.eyebrow")}
        title={t("announcements.title")}
        desc={t("announcements.desc")}
        icon={<IconChip icon={Newspaper} tone="sky" className="h-12 w-12" />}
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-slate-400">{t("announcements.loading")}</Card>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center">
          <Newspaper className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">{t("announcements.noUpdates")}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const hasImage = post.imageUrl && isMediaUrl(post.imageUrl);
            return (
              <Card key={post.id} className="overflow-hidden card-hover">
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
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900">{post.title}</h3>

                  {/* Body — render with line breaks */}
                  <div className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                    {post.body}
                  </div>

                  {/* Footer */}
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{t("announcements.publishedBy", { name: branding.companyName || t("announcements.defaultAdmin") })}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
