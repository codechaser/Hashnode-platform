import { Link } from "react-router-dom";
import ProfileAvatar from "./ProfileAvatar.jsx";
import TagBadge from "./TagBadge.jsx";

const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recently";
const getReadingTime = (content = "") => `${Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 220))} min read`;

function ArticleCard({ post, featured = false }) {
  const author = typeof post.author === "object" ? post.author : null;
  const authorName = author?.name || post.author || "Hashnode author";
  const metadata = [
    typeof post.content === "string" && post.content.trim() ? getReadingTime(post.content) : null,
    typeof post.viewCount === "number" ? `${post.viewCount.toLocaleString()} views` : null,
    typeof post.reactionCount === "number" ? `${post.reactionCount.toLocaleString()} reactions` : null,
    typeof post.commentCount === "number" ? `${post.commentCount.toLocaleString()} comments` : null,
  ].filter(Boolean).join(" · ");

  return (
    <article className={`article-card ${featured ? "article-card-featured" : ""}`}>
      {post.coverImage && <img className="article-cover" src={post.coverImage} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <div className="article-card-topline"><span className="article-kicker">{post.status === "draft" ? "Draft" : post.status === "scheduled" ? "Scheduled" : "Article"}</span><span>{metadata}</span></div>
      <h2><Link to={`/post/${post.slug}`}>{post.title}</Link></h2>
      <p className="article-excerpt">{post.excerpt || "A thoughtful piece from the Hashnode community."}</p>
      <div className="article-tags">{(post.tags || []).slice(0, 4).map((tag) => <TagBadge key={tag}>{tag}</TagBadge>)}</div>
      <footer className="article-card-footer">
        <span className="author-chip"><ProfileAvatar src={author?.avatarUrl} name={authorName} imageClassName="author-avatar" fallbackClassName="avatar avatar-small" /><span>{authorName}</span></span>
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
      </footer>
    </article>
  );
}

export { formatDate, getReadingTime };
export default ArticleCard;
