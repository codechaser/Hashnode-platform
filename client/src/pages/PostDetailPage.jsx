import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ArticleCard, { formatDate, getReadingTime } from "../components/ArticleCard.jsx";
import CommentsSection from "../components/CommentsSection.jsx";
import { ErrorState, LoadingSkeleton } from "../components/FeedbackStates.jsx";
import MarkdownRenderer from "../components/MarkdownRenderer.jsx";
import TagBadge from "../components/TagBadge.jsx";
import BookmarkButton from "../components/BookmarkButton.jsx";
import api from "../services/api.js";

function PostDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState({ count: 0, reacted: false });
  const [reactionLoading, setReactionLoading] = useState(false);
  const [reactionError, setReactionError] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPost() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/api/posts/${encodeURIComponent(slug)}`);
        const currentPost = response?.data?.post;
        if (!active) return;
        if (!currentPost) {
          setError("This article could not be found.");
          return;
        }
        setPost(currentPost);
        const reactionResponse = await api.get(`/api/posts/${currentPost._id}/reaction`);
        if (active) {
          setReaction({
            count: reactionResponse?.data?.count ?? currentPost.reactionCount ?? 0,
            reacted: Boolean(reactionResponse?.data?.reacted),
          });
        }
        const bookmarkResponse = await api.get(`/api/posts/${currentPost._id}/bookmark`);
        if (active) setBookmarked(Boolean(bookmarkResponse?.data?.bookmarked));
        if (currentPost.tags?.[0]) {
          const relatedResponse = await api.get("/api/posts/feed", { params: { tag: currentPost.tags[0], limit: 3 } });
          const relatedPosts = relatedResponse?.data?.posts || [];
          setRelated(relatedPosts.filter((item) => item.slug !== slug).slice(0, 2));
        }
      } catch (err) {
        if (active) setError(err?.response?.data?.message || "Unable to load this article.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPost();
    return () => { active = false; };
  }, [slug]);

  async function toggleReaction() {
    if (!user) {
      navigate("/login", { state: { from: `/post/${slug}` } });
      return;
    }

    if (reactionLoading || !post?._id) return;
    setReactionLoading(true);
    setReactionError("");

    try {
      const method = reaction.reacted ? "delete" : "post";
      const response = await api[method](`/api/posts/${post._id}/reaction`);
      setReaction({
        count: response?.data?.count ?? reaction.count,
        reacted: Boolean(response?.data?.reacted),
      });
    } catch (err) {
      setReactionError(err?.response?.data?.message || "Unable to update your reaction.");
    } finally {
      setReactionLoading(false);
    }
  }

  async function toggleBookmark() {
    if (!user) {
      navigate("/login", { state: { from: `/post/${slug}` } });
      return;
    }

    if (bookmarkLoading || !post?._id) return;
    setBookmarkLoading(true);
    setBookmarkError("");

    try {
      const method = bookmarked ? "delete" : "post";
      const response = await api[method](`/api/posts/${post._id}/bookmark`);
      setBookmarked(Boolean(response?.data?.bookmarked));
    } catch (err) {
      setBookmarkError(err?.response?.data?.message || "Unable to update your bookmark.");
    } finally {
      setBookmarkLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (loading) return <div className="page-wrap"><LoadingSkeleton count={1} /></div>;
  if (error || !post) return <div className="page-wrap"><ErrorState message={error || "Article not found."} /><Link className="back-link" to="/">&lt;- Back to explore</Link></div>;

  const author = typeof post.author === "object" ? post.author : null;
  const authorName = author?.name || "Hashnode author";

  return (
    <div className="page-wrap article-page">
      <Link className="back-link" to="/">&lt;- Back to explore</Link>
      <article className="article-reading-layout">
        <header className="article-header">
          <div className="article-tags">{(post.tags || []).map((tag) => <TagBadge key={tag}>{tag}</TagBadge>)}</div>
          <h1>{post.title}</h1>
          <p className="article-lede">{post.excerpt || "A practical note from the Hashnode community."}</p>
          <div className="article-author-row"><span className="avatar">{authorName.charAt(0).toUpperCase()}</span><div><strong>{authorName}</strong><span>{formatDate(post.createdAt)} <span aria-hidden="true">·</span> {getReadingTime(post.content)}</span></div></div>
        </header>
        <div className="article-body"><MarkdownRenderer content={post.content} /></div>
        <footer className="article-actions">
          <div className="article-reaction-area">
            <button className={`reaction-button ${reaction.reacted ? "reacted" : ""}`} type="button" onClick={toggleReaction} disabled={reactionLoading} aria-pressed={reaction.reacted}>
              <span aria-hidden="true">{reaction.reacted ? "♥" : "♡"}</span> {reactionLoading ? "Saving..." : reaction.reacted ? "Liked" : "Like"}
            </button>
            <span className="reaction-count">{reaction.count} {reaction.count === 1 ? "reaction" : "reactions"}</span>
            {reactionError && <span className="reaction-error" role="alert">{reactionError}</span>}
          </div>
          <div className="article-share"><span>Enjoyed this article?</span><button className="button button-secondary" type="button" onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</button></div>
          <div className="article-bookmark-area">
            <BookmarkButton bookmarked={bookmarked} loading={bookmarkLoading} onClick={toggleBookmark} />
            {bookmarkError && <span className="reaction-error" role="alert">{bookmarkError}</span>}
          </div>
        </footer>
      </article>
      <CommentsSection post={post} />
      {related.length > 0 && <section className="related-section"><div className="section-heading"><p className="section-label">KEEP READING</p><h2>More like this</h2></div><div className="article-grid">{related.map((item) => <ArticleCard key={item._id || item.slug} post={item} />)}</div></section>}
    </div>
  );
}

export default PostDetailPage;