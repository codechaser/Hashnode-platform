import { Link } from "react-router-dom";
import TagBadge from "./TagBadge.jsx";

const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recently";
const getReadingTime = (content = "") => `${Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 220))} min read`;

function ArticleCard({ post, featured = false }) {
  const author = typeof post.author === "object" ? post.author : null;
  const authorName = author?.name || post.author || "Hashnode author";

  return (
    <article className={`article-card ${featured ? "article-card-featured" : ""}`}>
      <div className="article-card-topline"><span className="article-kicker">{post.status === "draft" ? "Draft" : "Article"}</span><span>{getReadingTime(post.content)} <span aria-hidden="true">·</span> {post.reactionCount || 0} likes</span></div>
      <h2><Link to={`/post/${post.slug}`}>{post.title}</Link></h2>
      <p className="article-excerpt">{post.excerpt || "A thoughtful piece from the Hashnode community."}</p>
      <div className="article-tags">{(post.tags || []).slice(0, 4).map((tag) => <TagBadge key={tag}>{tag}</TagBadge>)}</div>
      <footer className="article-card-footer">
        <span className="author-chip">{author?.avatarUrl ? <img src={author.avatarUrl} alt="" /> : <span className="avatar avatar-small">{authorName.charAt(0).toUpperCase()}</span>}<span>{authorName}</span></span>
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
      </footer>
    </article>
  );
}

export { formatDate, getReadingTime };
export default ArticleCard;