import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";

const formatCommentDate = (value) => {
  if (!value) return "just now";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function CommentsSection({ post }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [activity, setActivity] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const canComment = Boolean(user);

  const authorName = useMemo(() => {
    if (!user) return "You";
    return user.name || user.username || "You";
  }, [user]);

  useEffect(() => {
    if (!post?._id) return;

    let active = true;

    async function loadComments() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/api/posts/${post._id}/comments`, { params: { page, limit: 10 } });
        if (!active) return;
        setComments(response?.data?.comments || []);
        setTotal(response?.data?.total || 0);
        setHasNextPage(Boolean(response?.data?.hasNextPage));
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.message || "Unable to load comments.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadComments();
    return () => { active = false; };
  }, [page, post?._id]);

  const submitComment = async (event) => {
    event.preventDefault();

    if (!user) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }

    const content = draft.trim();

    if (!content) {
      setError("Write a comment before submitting.");
      return;
    }

    if (content.length > 2000) {
      setError("Comments must be 2000 characters or fewer.");
      return;
    }

    setSubmitting(true);
    setError("");
    setActivity("");

    try {
      const response = await api.post(`/api/posts/${post._id}/comments`, { content });
      const createdComment = response?.data?.comment;

      if (createdComment) {
        setComments((current) => [createdComment, ...current]);
        setTotal((currentTotal) => currentTotal + 1);
      }

      setDraft("");
      setActivity("Comment published.");
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to publish your comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async (commentId) => {
    const content = editingDraft.trim();

    if (!content) {
      setError("Comment content cannot be empty.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await api.put(`/api/comments/${commentId}`, { content });
      const updated = response?.data?.comment;

      if (updated) {
        setComments((current) => current.map((comment) => comment._id === commentId ? updated : comment));
      }

      setEditingId(null);
      setEditingDraft("");
      setActivity("Comment updated.");
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to update this comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) {
      return;
    }

    setDeletingId(commentId);
    setError("");

    try {
      await api.delete(`/api/comments/${commentId}`);
      setComments((current) => current.filter((comment) => comment._id !== commentId));
      setTotal((currentTotal) => Math.max(currentTotal - 1, 0));
      setActivity("Comment deleted.");
      if (editingId === commentId) {
        setEditingId(null);
        setEditingDraft("");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to delete this comment.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="comments-section" aria-label="Comments">
      <div className="section-heading comments-heading">
        <p className="section-label">DISCUSSION</p>
        <h2>{total} {total === 1 ? "comment" : "comments"}</h2>
      </div>

      {canComment ? (
        <form className="comment-form" onSubmit={submitComment}>
          <label className="sr-only" htmlFor="comment-body">Write a comment</label>
          <textarea id="comment-body" rows="4" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Share your thoughts, ${authorName}...`} />
          <div className="comment-form-actions">
            <span className="comment-length">{draft.trim().length}/2000</span>
            <button className="button" type="submit" disabled={submitting || !draft.trim()}>{submitting ? "Posting..." : "Post comment"}</button>
          </div>
        </form>
      ) : (
        <div className="comment-login-prompt">
          <p>Join the conversation.</p>
          <Link className="button button-secondary" to="/login" state={{ from: window.location.pathname }}>Log in to comment</Link>
        </div>
      )}

      {error && <p className="auth-error" role="alert">{error}</p>}
      {activity && <p className="auth-success" role="status">{activity}</p>}

      {loading ? (
        <div className="skeleton-list" aria-label="Loading comments" role="status"><div className="skeleton-card"><span /><span /><span /></div></div>
      ) : comments.length === 0 ? (
        <div className="empty-state"><span className="empty-mark">/</span><h2>No comments yet</h2><p>Be the first to start the conversation.</p></div>
      ) : (
        <div className="comments-list">
          {comments.map((comment) => {
            const author = comment.author || {};
            const isOwner = Boolean(user && author.id === user.id);
            const isEditing = editingId === comment._id;

            return (
              <article className="comment-item" key={comment._id}>
                <div className="comment-header">
                  <div className="author-chip">
                    <span className="avatar avatar-small">{(author.name || author.username || "A").charAt(0).toUpperCase()}</span>
                    <div>
                      <strong>{author.name || author.username || "Hashnode reader"}</strong>
                      <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
                    </div>
                  </div>

                  {isOwner && !isEditing && (
                    <div className="comment-actions">
                      <button type="button" className="button button-secondary button-small" onClick={() => { setEditingId(comment._id); setEditingDraft(comment.content); }}>Edit</button>
                      <button type="button" className="button button-small button-danger" onClick={() => deleteComment(comment._id)} disabled={deletingId === comment._id}>{deletingId === comment._id ? "Deleting..." : "Delete"}</button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="comment-edit-box">
                    <textarea rows="4" value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} />
                    <div className="comment-form-actions">
                      <span className="comment-length">{editingDraft.trim().length}/2000</span>
                      <div className="comment-actions">
                        <button type="button" className="button button-secondary" onClick={() => { setEditingId(null); setEditingDraft(""); }}>Cancel</button>
                        <button type="button" className="button" onClick={() => saveEdit(comment._id)} disabled={submitting || !editingDraft.trim()}>{submitting ? "Saving..." : "Save"}</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="comment-body">{comment.content}</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {hasNextPage && (
        <div className="comments-pagination">
          <button type="button" className="button button-secondary" onClick={() => setPage((current) => current + 1)}>Load more comments</button>
        </div>
      )}
    </section>
  );
}

export default CommentsSection;
