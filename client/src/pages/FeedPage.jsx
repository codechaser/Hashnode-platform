import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ArticleCard from "../components/ArticleCard.jsx";
import { EmptyState, ErrorState, LoadingSkeleton } from "../components/FeedbackStates.jsx";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [trendingTags, setTrendingTags] = useState([]);
  const [suggestedWriters, setSuggestedWriters] = useState([]);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [error, setError] = useState("");
  const search = searchParams.get("search") || "";
  const selectedTag = searchParams.get("tag") || "";
  const feedMode = searchParams.get("feed") === "following" ? "following" : "latest";

  async function loadFeed(nextPage = 1, append = false) {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const [feedResult, tagResult, trendingResult, writersResult] = await Promise.allSettled([
        api.get(feedMode === "following" ? "/api/posts/feed/following" : "/api/posts/feed", { params: { search, tag: selectedTag, page: nextPage, limit: 10 } }),
        api.get("/api/tags"),
        api.get("/api/tags/trending"),
        api.get("/api/users/discover"),
      ]);
      if (feedResult.status === "rejected") throw feedResult.reason;
      const feedResponse = feedResult.value;
      const nextPosts = feedResponse?.data?.posts || [];
      setPosts((currentPosts) => {
        if (!append) return nextPosts;
        const existingIds = new Set(currentPosts.map((post) => post._id || post.slug));
        return [...currentPosts, ...nextPosts.filter((post) => !existingIds.has(post._id || post.slug))];
      });
      setPage(feedResponse?.data?.page || nextPage);
      setHasNextPage(Boolean(feedResponse?.data?.hasNextPage));
      setTags(tagResult.status === "fulfilled" ? tagResult.value?.data?.tags || [] : []);
      setTrendingTags(trendingResult.status === "fulfilled" ? trendingResult.value?.data?.tags || [] : []);
      setSuggestedWriters(writersResult.status === "fulfilled" ? writersResult.value?.data?.writers || [] : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load the community feed.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFeed(1, false);
  }, [search, selectedTag, feedMode]);

  function handleSearch(event) {
    event.preventDefault();
    const next = {};
    if (searchInput.trim()) next.search = searchInput.trim();
    if (selectedTag) next.tag = selectedTag;
    if (feedMode === "following") next.feed = feedMode;
    setSearchParams(next);
  }

  function selectTag(tag) {
    const next = {};
    if (search) next.search = search;
    if (tag) next.tag = tag;
    if (feedMode === "following") next.feed = feedMode;
    setSearchParams(next);
  }

  function selectFeedMode(mode) {
    if (mode === "following" && !user) {
      navigate("/login", { state: { from: "/?feed=following" } });
      return;
    }
    const next = {};
    if (search) next.search = search;
    if (selectedTag) next.tag = selectedTag;
    if (mode === "following") next.feed = mode;
    setSearchParams(next);
  }

  function loadMore() {
    if (loading || loadingMore || !hasNextPage) return;
    loadFeed(page + 1, true);
  }

  return (
    <div className="page-wrap feed-page">
      <section className="feed-hero">
        <div className="hero-copy">
          <p className="eyebrow">THE DEVELOPER READING ROOM</p>
          <h1>Build in public.<br /><em>Learn in company.</em></h1>
          <p className="hero-description">Practical notes, sharp opinions, and hard-won lessons from people making things on the web.</p>
          <div className="hero-actions"><Link className="button button-primary" to="/editor">Share an idea <span aria-hidden="true">-&gt;</span></Link><Link className="button button-secondary" to="/writers">Find writers</Link></div>
        </div>
        <div className="hero-aside" aria-label="Community highlights">
          <span className="hero-aside-number">01</span>
          <p>Useful writing<br /><strong>for the next thing</strong></p>
          <span className="hero-aside-line" />
          <p className="hero-aside-note">Fresh perspectives from a growing developer community.</p>
        </div>
      </section>

      {(trendingTags.length > 0 || suggestedWriters.length > 0) && <section className="discovery-grid" aria-label="Community discovery">
        {trendingTags.length > 0 && <div className="discovery-panel">
          <div className="discovery-heading"><div><p className="section-label">THE LAST 30 DAYS</p><h2>Trending topics</h2></div><span aria-hidden="true">↗</span></div>
          <div className="discovery-tags">{trendingTags.map((tag) => <button type="button" key={tag.slug} onClick={() => selectTag(tag.name)}><span>#{tag.name}</span><small>{tag.postCount} {tag.postCount === 1 ? "article" : "articles"}</small></button>)}</div>
        </div>}
        {suggestedWriters.length > 0 && <div className="discovery-panel">
          <div className="discovery-heading"><div><p className="section-label">ACTIVE IN THE LAST 90 DAYS</p><h2>Writers to follow</h2></div><span aria-hidden="true">✳</span></div>
          <div className="discovery-writers">{suggestedWriters.map((writer) => <Link className="discovery-writer" to={`/profile/${writer.username}`} key={writer.id}>
            {writer.avatarUrl ? <img src={writer.avatarUrl} alt="" /> : <span className="discovery-avatar" aria-hidden="true">{writer.name?.slice(0, 1)?.toUpperCase()}</span>}
            <span className="discovery-writer-copy"><strong>{writer.name}</strong><small>@{writer.username} · {writer.articleCount} recent {writer.articleCount === 1 ? "article" : "articles"}</small>{writer.bio && <small className="discovery-bio">{writer.bio}</small>}</span>
            <span className="discovery-follow" aria-hidden="true">View</span>
          </Link>)}</div>
        </div>}
      </section>}

      <section className="feed-toolbar" aria-label="Explore articles">
        <div>
          <p className="section-label">{feedMode === "following" ? "YOUR READING CIRCLE" : "LATEST FROM THE COMMUNITY"}</p>
          <h2>Explore ideas</h2>
          <div className="feed-mode-tabs" role="tablist" aria-label="Choose article feed">
            <button type="button" role="tab" aria-selected={feedMode === "latest"} className={feedMode === "latest" ? "active" : ""} onClick={() => selectFeedMode("latest")}>Everyone</button>
            <button type="button" role="tab" aria-selected={feedMode === "following"} className={feedMode === "following" ? "active" : ""} onClick={() => selectFeedMode("following")}>Following</button>
          </div>
        </div>
        <form className="search-form" onSubmit={handleSearch} role="search">
          <label className="sr-only" htmlFor="feed-search">Search article titles</label>
          <input id="feed-search" type="search" placeholder="Search titles..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          <button className="button button-dark" type="submit">Search</button>
        </form>
      </section>

      <div className="tag-filter-row">
        <button className={`tag-filter ${!selectedTag ? "selected" : ""}`} type="button" onClick={() => selectTag("")}>All topics</button>
        {tags.slice(0, 10).map((tag) => <button className={`tag-filter ${selectedTag.toLowerCase() === tag.name.toLowerCase() ? "selected" : ""}`} type="button" key={tag._id || tag.slug} onClick={() => selectTag(tag.name)}>{tag.name}</button>)}
      </div>

      {loading && <LoadingSkeleton />}
      {!loading && error && <ErrorState message={error} onRetry={loadFeed} />}
      {!loading && !error && posts.length === 0 && <EmptyState title={feedMode === "following" ? "Your feed is ready to grow" : "No articles found"} message={feedMode === "following" ? "Follow a few writers to see their new articles here." : "Try another title or topic, or be the first person to publish an idea here."} action={feedMode === "following" ? <Link className="button button-secondary" to="/writers">Find writers to follow</Link> : <Link className="button button-secondary" to="/editor">Write an article</Link>} />}
      {!loading && !error && posts.length > 0 && <>
        <section className="article-grid" aria-label="Published articles">{posts.map((post, index) => <ArticleCard key={post._id || post.slug} post={post} featured={index === 0} />)}</section>
        {hasNextPage && <div className="load-more-wrap"><button className="button button-secondary" type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading more..." : "Load more articles"}</button></div>}
      </>}
    </div>
  );
}

export default FeedPage;
