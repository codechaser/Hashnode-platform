import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ArticleCard from "../components/ArticleCard.jsx";
import BookmarkButton from "../components/BookmarkButton.jsx";
import { ErrorState, LoadingSkeleton } from "../components/FeedbackStates.jsx";
import api from "../services/api.js";

function BookmarksPage() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);

  const loadBookmarks = useCallback(async (nextPage = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/users/me/bookmarks", { params: { page: nextPage, limit: 10 } });
      const data = response?.data || {};
      const nextBookmarks = (data.bookmarks || []).map((bookmark) => ({
        ...bookmark.post,
        bookmarkId: bookmark._id,
      }));
      setBookmarks((current) => append ? [...current, ...nextBookmarks] : nextBookmarks);
      setPage(data.page || nextPage);
      setHasNextPage(Boolean(data.hasNextPage));
    } catch (err) {
      if (err?.response?.status === 401) {
        navigate("/login", { replace: true, state: { from: "/bookmarks" } });
      } else {
        setError(err?.response?.data?.message || "Unable to load your bookmarks.");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  async function removeBookmark(post) {
    if (removingId || !post?._id) return;
    setRemovingId(post._id);
    setError("");

    try {
      await api.delete(`/api/posts/${post._id}/bookmark`);
      setBookmarks((current) => current.filter((item) => item._id !== post._id));
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to remove this bookmark.");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) return <div className="page-wrap"><LoadingSkeleton count={2} /></div>;
  if (error && !bookmarks.length) return <div className="page-wrap"><ErrorState message={error} /></div>;

  return (
    <div className="page-wrap bookmarks-page">
      <header className="bookmarks-header">
        <p className="eyebrow">Your reading list</p>
        <h1>Saved articles</h1>
        <p>Keep the ideas worth returning to close at hand.</p>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!bookmarks.length ? (
        <section className="empty-state">
          <p className="section-label">Nothing saved yet</p>
          <h2>Build your reading list</h2>
          <p>Bookmark an article from Explore and it will appear here.</p>
          <Link className="button button-primary" to="/">Explore articles</Link>
        </section>
      ) : (
        <>
          <div className="article-grid">
            {bookmarks.map((post) => (
              <div className="bookmark-card-wrap" key={post._id}>
                <ArticleCard post={post} />
                <BookmarkButton
                  bookmarked
                  compact
                  loading={removingId === post._id}
                  onClick={() => removeBookmark(post)}
                />
              </div>
            ))}
          </div>
          {hasNextPage && (
            <div className="load-more-wrap">
              <button className="button button-secondary" type="button" disabled={loadingMore} onClick={() => loadBookmarks(page + 1, true)}>
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BookmarksPage;
