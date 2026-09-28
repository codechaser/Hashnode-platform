import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { EmptyState, ErrorState, LoadingSkeleton } from "../components/FeedbackStates.jsx";
import api from "../services/api.js";
import { useSubscription } from "../context/SubscriptionContext.jsx";

const FILTERS = {
  all: "All",
  draft: "Drafts",
  published: "Published",
};

function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, isActivationPending } = useSubscription();
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardPosts() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/api/posts");
        if (!cancelled) {
          setPosts(response?.data?.posts || []);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err?.response?.data?.message || "Unable to load your dashboard posts.";
          setError(message === "Authentication required" ? "Your session is expired or invalid. Please log in again." : message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboardPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => { if (isPro) api.get("/api/posts/analytics").then(({ data }) => setAnalytics(data)).catch((err) => setAnalyticsError(err.response?.data?.message || "Analytics are temporarily unavailable.")); }, [isPro]);

  const visiblePosts = useMemo(() => {
    if (filter === "all") {
      return posts;
    }

    return posts.filter((post) => post.status === filter);
  }, [posts, filter]);

  async function handleDelete(post) {
    if (!post?._id) {
      return;
    }

    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/api/posts/${post._id}`);
      setPosts((currentPosts) => currentPosts.filter((item) => item._id !== post._id));
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to delete this post.";
      setError(message === "Authentication required" ? "Your session is expired or invalid. Please log in again." : message);
    }
  }

  return (
    <div className="page-wrap dashboard-page">
      <section className="dashboard-header">
        <div><p className="eyebrow">YOUR WORKSPACE</p><h1>Welcome back, {user?.name?.split(" ")[0] || "writer"}.</h1><p>Shape your next useful idea.</p></div>
        <Link className="button button-primary" to="/editor">+ Create article</Link>
      </section>
      <section className="dashboard-stats" aria-label="Article statistics">
        <div className="stat-card"><span>Total articles</span><strong>{posts.length}</strong></div>
        <div className="stat-card"><span>Published</span><strong>{posts.filter((post) => post.status === "published").length}</strong></div>
        <div className="stat-card"><span>Drafts</span><strong>{posts.filter((post) => post.status === "draft").length}</strong></div>
        {user && <div className="stat-card plan-stat"><span>Plan</span><strong>{isPro ? "PRO" : isActivationPending ? "Activating PRO…" : "FREE"}</strong></div>}
      </section>
      <section className="creator-insights" aria-label="Creator analytics">
        <div className="dashboard-header"><div><p className="section-label">CREATOR TOOLS</p><h2>Creator analytics</h2></div>{isPro && <span className="pro-badge">PRO</span>}</div>
        {isPro ? <>{analyticsError && <ErrorState message={analyticsError} />}{analytics && <><div className="dashboard-stats"><div className="stat-card"><span>Total views</span><strong>{analytics.totals.views.toLocaleString()}</strong></div><div className="stat-card"><span>Reactions</span><strong>{analytics.totals.reactions}</strong></div><div className="stat-card"><span>Comments</span><strong>{analytics.totals.comments}</strong></div><div className="stat-card"><span>Bookmarks</span><strong>{analytics.totals.bookmarks}</strong></div></div><p className="activity-note">{analytics.totals.recentViews} reading visits in the last 30 days.</p><h3>Top articles</h3>{analytics.topArticles.length ? analytics.topArticles.map((post) => <p className="insight-row" key={post._id}><Link to={`/post/${post.slug}`}>{post.title}</Link><strong>{post.viewCount.toLocaleString()} views</strong></p>) : <p>Publish an article to start seeing its performance.</p>}<h3>Publishing schedule</h3>{analytics.schedule.length ? analytics.schedule.map((post) => <p className="insight-row" key={post._id}><Link to={`/editor/${post._id}`}>{post.title}</Link><span>{new Date(post.scheduledAt).toLocaleString()}</span></p>) : <p>No articles scheduled.</p>}</>}</> : <div className="locked-preview"><h3>Understand which articles resonate with your audience.</h3><p>Unlock creator analytics, scheduled publishing, cover images, and version history.</p><Link className="button button-primary" to="/pricing">Unlock with PRO</Link></div>}
      </section>
      <section className="dashboard-layout">
        <div className="dashboard-header"><div><p className="section-label">ARTICLE MANAGEMENT</p><h2>Your articles</h2></div><div className="dashboard-filters">{Object.entries(FILTERS).map(([key, label]) => <button key={key} className={`filter-chip ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)} type="button">{label}</button>)}</div></div>
        {loading && <LoadingSkeleton />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && visiblePosts.length === 0 && <EmptyState title={`No ${filter === "all" ? "articles" : FILTERS[filter].toLowerCase()} yet`} message="Your next published idea can start here." action={<Link className="button button-secondary" to="/editor">Start writing</Link>} />}
        {!loading && !error && visiblePosts.length > 0 && <div className="dashboard-list">{visiblePosts.map((post) => <article className="management-card" key={post._id}><div><h2><Link to={post.status === "published" ? `/post/${post.slug}` : `/editor/${post._id}`}>{post.title}</Link></h2><p>{post.excerpt || "No excerpt added yet."}</p><div className="management-meta"><span className={`status-badge ${post.status}`}>{post.status}</span><span>{post.status === "scheduled" && post.scheduledAt ? `Publishes ${new Date(post.scheduledAt).toLocaleString()}` : (post.tags || []).join(" · ") || "Untagged"}</span><span>Updated {new Date(post.updatedAt).toLocaleDateString()}</span></div></div><div className="management-actions"><button className="action-button" type="button" onClick={() => navigate(`/editor/${post._id}`)}>Edit</button>{isPro && post.status === "published" && <button className="action-button" type="button" onClick={async () => { try { await api.post("/api/users/me/featured", { postId: post._id }); setError(""); } catch (err) { setError(err.response?.data?.message || "Unable to feature article."); } }}>Feature</button>}<button className="action-button delete" type="button" onClick={() => handleDelete(post)}>Delete</button></div></article>)}</div>}
      </section>
    </div>
  );
}

export default DashboardPage;
