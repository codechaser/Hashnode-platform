import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, ErrorState, LoadingSkeleton } from "../components/FeedbackStates.jsx";
import api from "../services/api.js";

const describeNotification = (item) => {
  const name = item.actor?.name || "A community member";
  if (item.type === "follow") return `${name} followed you.`;
  if (item.type === "reaction") return `${name} liked your article.`;
  return `${name} commented on your article.`;
};

const timeLabel = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Recently";

function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadNotifications(nextPage = 1, append = false) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/notifications", { params: { page: nextPage, limit: 20 } });
      const data = response.data;
      setNotifications((current) => append ? [...current, ...(data.notifications || [])] : data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setPage(data.page || nextPage);
      setHasNextPage(Boolean(data.hasNextPage));
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markRead(item) {
    if (!item.readAt) {
      setSaving(true);
      try {
        await api.patch(`/api/notifications/${item.id}/read`);
        const readAt = new Date().toISOString();
        setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, readAt } : notification));
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (err) {
        setError(err?.response?.data?.message || "Unable to update notification.");
      } finally {
        setSaving(false);
      }
    }
    const target = item.post?.slug
      ? `/post/${item.post.slug}`
      : item.actor?.username ? `/profile/${item.actor.username}` : "/";
    navigate(target);
  }

  async function markAllRead() {
    if (!unreadCount || saving) return;
    setSaving(true);
    try {
      await api.patch("/api/notifications/read-all");
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => item.readAt ? item : { ...item, readAt }));
      setUnreadCount(0);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to update notifications.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="page-wrap notifications-page">
    <header className="notifications-header">
      <div><p className="eyebrow">YOUR COMMUNITY</p><h1>Notifications</h1><p>See who is connecting with your writing.</p></div>
      {unreadCount > 0 && <button className="button button-secondary" type="button" disabled={saving} onClick={markAllRead}>Mark all read</button>}
    </header>
    {!loading && error && <ErrorState message={error} onRetry={() => loadNotifications()} />}
    {loading && <LoadingSkeleton />}
    {!loading && !error && notifications.length === 0 && <EmptyState title="You're all caught up" message="New followers, likes, and comments will show up here." action={<Link className="button button-secondary" to="/">Explore articles</Link>} />}
    {!loading && !error && notifications.length > 0 && <>
      <section className="notification-list" aria-label="Your notifications">
        {notifications.map((item) => <button className={`notification-item ${item.readAt ? "is-read" : "is-unread"}`} type="button" key={item.id} disabled={saving} onClick={() => markRead(item)}>
          {item.actor?.avatarUrl ? <img className="notification-avatar" src={item.actor.avatarUrl} alt="" /> : <span className="notification-avatar notification-avatar-fallback" aria-hidden="true">{item.actor?.name?.slice(0, 1)?.toUpperCase() || "H"}</span>}
          <span className="notification-copy"><strong>{describeNotification(item)}</strong>{item.post?.title && <span className="notification-post-title">{item.post.title}</span>}<time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time></span>
          {!item.readAt && <span className="notification-unread-dot" aria-label="Unread" />}
        </button>)}
      </section>
      {hasNextPage && <div className="load-more-wrap"><button className="button button-secondary" type="button" disabled={loadingMore} onClick={() => loadNotifications(page + 1, true)}>{loadingMore ? "Loading..." : "Load older notifications"}</button></div>}
    </>}
  </div>;
}

export default NotificationsPage;
