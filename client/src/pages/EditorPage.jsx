import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MarkdownRenderer from "../components/MarkdownRenderer.jsx";
import api from "../services/api.js";
import { useSubscription } from "../context/SubscriptionContext.jsx";

function RevisionHistory({ postId }) {
  const [revisions, setRevisions] = useState([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRevision, setSelectedRevision] = useState(null);
  async function load() {
    try { const { data } = await api.get(`/api/posts/${postId}/revisions`); setRevisions(data.revisions || []); setOpen(true); setMessage(""); }
    catch (error) { setMessage(error.response?.data?.message || "Unable to load revisions."); }
  }
  async function restore(revisionId) {
    const revision = revisions.find((item) => item._id === revisionId);
    if (!window.confirm(`Restore “${revision?.title || "this version"}”? Your current version will be saved first.`)) return;
    try { await api.post(`/api/posts/${postId}/revisions/${revisionId}/restore`); window.location.reload(); }
    catch (error) { setMessage(error.response?.data?.message || "Unable to restore revision."); }
  }
  return <section className="revision-panel"><button className="action-button" type="button" onClick={load}>Version history</button>{message && <p role="alert">{message}</p>}{open && <div><h3>Previous versions</h3>{revisions.length ? revisions.map((revision) => <article key={revision._id}><span>{new Date(revision.createdAt).toLocaleString()} · {revision.title}</span><div className="revision-actions"><button className="action-button" type="button" aria-pressed={selectedRevision?._id === revision._id} onClick={() => setSelectedRevision(selectedRevision?._id === revision._id ? null : revision)}>Preview</button><button className="action-button" type="button" onClick={() => restore(revision._id)}>Restore</button></div></article>) : <p>No saved versions yet. Meaningful edits are captured as revisions.</p>}{selectedRevision && <section className="revision-preview" aria-label={`Preview of ${selectedRevision.title}`}><h4>{selectedRevision.title}</h4>{selectedRevision.excerpt && <p>{selectedRevision.excerpt}</p>}{selectedRevision.tags?.length > 0 && <p className="revision-tags">Tags: {selectedRevision.tags.join(", ")}</p>}<div className="markdown-preview-surface"><MarkdownRenderer content={selectedRevision.content} /></div></section>}</div>}</section>;
}

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  tags: "",
  scheduledAt: "",
  coverImage: "",
  status: "draft",
};

const parseTags = (tagsText) => {
  return tagsText
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
};

function EditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const { isPro } = useSubscription();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState("write");

  useEffect(() => {
    if (!editing) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPost() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/api/posts/${id}`);
        const post = response?.data?.post;

        if (!cancelled && post) {
          setForm({
            title: post.title || "",
            slug: post.slug || "",
            excerpt: post.excerpt || "",
            content: post.content || "",
            tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
            scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : "",
            coverImage: post.coverImage || "",
            status: post.status || "draft",
          });
          setDirty(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err?.response?.data?.message || "Unable to load this post.";
          setError(message === "Authentication required" ? "Your session is expired or invalid. Please log in again." : message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPost();

    return () => {
      cancelled = true;
    };
  }, [editing, id]);

  const previewContent = useMemo(() => {
    return form.content || "";
  }, [form.content]);

  async function handleSave(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const cleanTitle = form.title.trim();
    const cleanSlug = form.slug.trim();
    const cleanExcerpt = form.excerpt.trim();
    const cleanContent = form.content.trim();

    if (!cleanTitle) {
      setError("Title is required.");
      return;
    }

    if (!cleanSlug) {
      setError("Slug is required.");
      return;
    }

    if (!cleanContent) {
      setError("Content is required.");
      return;
    }

    if (!['draft', 'published', 'scheduled'].includes(form.status)) {
      setError("Choose a valid publishing status.");
      return;
    }
    if (form.status === "scheduled" && (!form.scheduledAt || new Date(form.scheduledAt) <= new Date())) { setError("Choose a future publishing date and time."); return; }

    const payload = {
      title: cleanTitle,
      slug: cleanSlug,
      excerpt: cleanExcerpt,
      content: cleanContent,
      tags: parseTags(form.tags),
      status: form.status,
      ...(form.status === "scheduled" ? { scheduledAt: new Date(form.scheduledAt).toISOString() } : {}),
      ...(isPro ? { coverImage: form.coverImage.trim() } : {}),
    };

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let response;

      if (editing) {
        response = await api.put(`/api/posts/${id}`, payload);
      } else {
        response = await api.post("/api/posts", payload);
      }

      const post = response?.data?.post;
      const nextRoute = post?._id ? `/dashboard` : "/dashboard";
      setDirty(false);
      setSuccess(editing ? "Post updated." : "Post created.");
      navigate(nextRoute);
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to save this post.";
      setError(message === "Authentication required" ? "Your session is expired or invalid. Please log in again." : message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="page-wrap"><p className="eyebrow">EDITOR</p><h1>Loading post…</h1></div>;
  }

  return (
    <div className="page-wrap editor-page editor-shell">
      <section className="editor-layout">
        <div className="editor-header">
          <div>
            <p className="eyebrow">{editing ? "EDIT POST" : "CREATE POST"}</p>
            <h1>{editing ? "Edit post" : "Create post"}</h1>
          </div>
          <div><span className="save-indicator">{dirty ? "Unsaved changes" : "All changes saved"}</span><div className="editor-view-switch">
            <button className={view === "write" ? "active" : ""} type="button" onClick={() => setView("write")}>Write</button>
            <button className={view === "preview" ? "active" : ""} type="button" onClick={() => setView("preview")}>Preview</button>
          </div></div>
        </div>

        {error && <p className="editor-error">{error}</p>}
        {success && <p className="editor-success">{success}</p>}

        {view === "write" ? (
          <form className="editor-form" onSubmit={handleSave}>
            <label>
              <span>Title</span>
              <input type="text" value={form.title} onChange={(event) => { setDirty(true); setForm({ ...form, title: event.target.value }); }} required />
            </label>

            <label>
              <span>Slug</span>
              <input type="text" value={form.slug} onChange={(event) => { setDirty(true); setForm({ ...form, slug: event.target.value }); }} required />
            </label>

            <label>
              <span>Excerpt</span>
              <textarea value={form.excerpt} onChange={(event) => { setDirty(true); setForm({ ...form, excerpt: event.target.value }); }} />
            </label>

            <label>
              <span>Markdown content</span>
              <textarea className="markdown-content" value={form.content} onChange={(event) => { setDirty(true); setForm({ ...form, content: event.target.value }); }} required />
            </label>

            <label>
              <span>Tags</span>
              <input type="text" value={form.tags} onChange={(event) => { setDirty(true); setForm({ ...form, tags: event.target.value }); }} placeholder="javascript python" />
            </label>

            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => { setDirty(true); setForm({ ...form, status: event.target.value }); }}>
                <option value="draft">Draft</option>
              <option value="published">Published</option>
              {isPro && <option value="scheduled">Scheduled</option>}
            </select>
            </label>

            {isPro ? <>
              {form.status === "scheduled" && <label><span>Publish date and time</span><input aria-label="Scheduled publish date and time" type="datetime-local" min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} value={form.scheduledAt} onChange={(event) => { setDirty(true); setForm({ ...form, scheduledAt: event.target.value }); }} required /></label>}
              <label><span>Cover image URL (HTTPS)</span><input type="url" placeholder="https://…" value={form.coverImage} onChange={(event) => { setDirty(true); setForm({ ...form, coverImage: event.target.value }); }} /></label>
              {editing && <RevisionHistory postId={id} />}
            </> : <p className="locked-feature">Scheduling, cover images, and version history are PRO features. <Link to="/pricing">Explore PRO</Link></p>}

            <div className="editor-actions">
              <button type="button" onClick={() => navigate("/dashboard")}>Cancel</button>
              <button type="submit" disabled={saving}>
                {saving ? (editing ? "Saving..." : "Creating...") : (editing ? "Save changes" : "Create post")}
              </button>
            </div>
          </form>
        ) : (
          <section className="editor-preview">
            <div className="markdown-preview-surface">
              <MarkdownRenderer content={previewContent} />
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

export default EditorPage;
