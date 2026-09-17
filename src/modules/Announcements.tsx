import { useState } from "react";
import { Newspaper, Plus, Pencil, Trash2, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { PageHeader, Card, Badge, IconChip, DataTable, type Column } from "@/components/ui";
import { useLiveData } from "@/lib/useLiveData";
import { useApp } from "@/context/AppContext";
import { crudRead, crudCreate, crudUpdate, crudDelete } from "@/lib/repo";
import { isMediaUrl } from "@/lib/branding";

interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  category: string;
  published: boolean;
  created_at?: string;
}

const CATEGORIES = ["News", "Advisory", "Event", "Price Update", "Weather Alert", "General"];

export default function Announcements() {
  const { notify } = useApp();
  const { data: rawRows, loading, reload } = useLiveData<Record<string, unknown>>("announcements", () => crudRead("announcements"));
  const rows: Announcement[] = rawRows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    imageUrl: r.image_url as string,
    category: r.category as string,
    published: Boolean(r.published),
    created_at: r.created_at as string,
  }));

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("News");
  const [imageUrl, setImageUrl] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(true);

  const resetForm = () => {
    setTitle(""); setCategory("News"); setImageUrl(""); setBody(""); setPublished(true);
  };

  const startAdd = () => {
    resetForm();
    setAdding(true);
    setEditing(null);
    setConfirmDelete(null);
    setError(null);
  };

  const startEdit = (a: Announcement) => {
    setTitle(a.title); setCategory(a.category); setImageUrl(a.imageUrl); setBody(a.body); setPublished(a.published);
    setEditing(a);
    setAdding(false);
    setConfirmDelete(null);
    setError(null);
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (!body.trim()) { setError("Article body is required."); return; }

    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        image_url: imageUrl.trim() || null,
        category,
        published,
      };

      if (editing) {
        await crudUpdate("announcements", editing.id, payload);
        notify({ title: "Article updated ✅", body: `"${title}" has been updated.`, tone: "emerald", channel: "system" });
      } else {
        await crudCreate("announcements", payload);
        notify({ title: "Article published ✅", body: `"${title}" is now live for suppliers.`, tone: "emerald", channel: "system" });
      }

      void reload();
      resetForm();
      setAdding(false);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Announcement) => {
    setBusy(true);
    setError(null);
    try {
      await crudDelete("announcements", a.id);
      void reload();
      notify({ title: "Article deleted", body: `"${a.title}" removed.`, tone: "rose", channel: "system" });
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm";
  const labelCls = "text-[11px] font-medium text-slate-400";

  // Check if image URL is valid
  const showImagePreview = imageUrl.trim() && isMediaUrl(imageUrl.trim());

  const columns: Column<Announcement>[] = [
    {
      key: "title",
      header: "Title",
      render: (a) => (
        <div className="flex items-center gap-2">
          {a.imageUrl && isMediaUrl(a.imageUrl) && (
            <img src={a.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <span className="font-semibold text-slate-800">{a.title}</span>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (a) => <Badge tone="sky">{a.category}</Badge> },
    { key: "published", header: "Status", align: "center", render: (a) => a.published ? <Badge tone="emerald">Published</Badge> : <Badge tone="slate">Draft</Badge> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (a) => (
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={() => startEdit(a)} title="Edit" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => { setConfirmDelete(a); setError(null); }} title="Delete" className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Announcements & Articles"
        desc="Publish news, advisories, and articles. Suppliers see them instantly in their 'Estate Updates' tab."
        icon={<IconChip icon={Newspaper} tone="emerald" className="h-12 w-12" />}
        actions={
          <button onClick={startAdd} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110">
            <Plus className="h-4 w-4" /> New Article
          </button>
        }
      />

      {/* CREATE / EDIT FORM */}
      {(adding || editing) && (
        <Card className="mt-4 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-800">
              {editing ? "Edit Article" : "Write New Article"}
            </h3>
            <button onClick={() => { setAdding(false); setEditing(null); setError(null); }} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Row 1: Title + Category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New Fertilizer Subsidy Announced"
                className={`${inputCls} font-medium`}
                maxLength={200}
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Image URL */}
          <div className="mt-4">
            <label className={labelCls}>Image URL (optional — paste Cloudinary link)</label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://res.cloudinary.com/..."
              className={inputCls}
            />
            {showImagePreview && (
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                <img src={imageUrl} alt="Preview" className="h-40 w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>

          {/* Row 3: BIG TEXTAREA for article body */}
          <div className="mt-4">
            <label className={labelCls}>
              Article Body * — write as much as you want (unlimited length)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              placeholder={"Write your full article here...\n\nYou can type unlimited paragraphs.\nLine breaks are preserved.\n\nPaste long text — no limits."}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-relaxed resize-y min-h-[320px] focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
              maxLength={50000}
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[10px] text-slate-300">Tip: Use blank lines to separate paragraphs.</p>
              <p className="text-[10px] text-slate-400 tnum">{body.length} / 50,000 chars</p>
            </div>
          </div>

          {/* Row 4: Published toggle */}
          <div className="mt-4 flex items-center gap-3">
            <label className={labelCls}>Publish now?</label>
            <button
              onClick={() => setPublished((p) => !p)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${published ? "bg-emerald-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${published ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-xs font-semibold text-slate-500">{published ? "Will be visible to suppliers" : "Saved as draft (hidden)"}</span>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setEditing(null); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? "Save Changes" : "Publish Article"}
            </button>
          </div>
        </Card>
      )}

      {/* DELETE CONFIRMATION */}
      {confirmDelete && (
        <Card className="mt-4 border-rose-200 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">Delete "{confirmDelete.title}"?</p>
              <p className="mt-0.5 text-xs text-slate-500">This permanently removes the article. Suppliers will no longer see it.</p>
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setConfirmDelete(null); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
              Cancel
            </button>
            <button onClick={() => remove(confirmDelete)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete permanently
            </button>
          </div>
        </Card>
      )}

      {/* DATA TABLE */}
      <Card className="mt-4 p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading articles…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <Newspaper className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No articles yet. Click "New Article" to publish your first one.</p>
          </div>
        ) : (
          <DataTable<Announcement> rows={rows} columns={columns} searchable={false} />
        )}
      </Card>
    </div>
  );
}
