import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ArticleCard from "../components/ArticleCard.jsx";
import { EmptyState, ErrorState, LoadingSkeleton } from "../components/FeedbackStates.jsx";
import api from "../services/api.js";

function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [error, setError] = useState("");
  const search = searchParams.get("search") || "";
  const selectedTag = searchParams.get("tag") || "";

  async function loadFeed(nextPage = 1, append = false) {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const [feedResponse, tagResponse] = await Promise.all([
        api.get("/api/posts/feed", { params: { search, tag: selectedTag, page: nextPage, limit: 10 } }),
        api.get("/api/tags"),
      ]);
      const nextPosts = feedResponse?.data?.posts || [];
      setPosts((currentPosts) => {
        if (!append) return nextPosts;
        const existingIds = new Set(currentPosts.map((post) => post._id || post.slug));
        return [...currentPosts, ...nextPosts.filter((post) => !existingIds.has(post._id || post.slug))];
      });
      setPage(feedResponse?.data?.page || nextPage);
      setHasNextPage(Boolean(feedResponse?.data?.hasNextPage));
      setTags(tagResponse?.data?.tags || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load the community feed.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFeed(1, false);
  }, [search, selectedTag]);

  function handleSearch(event) {
    event.preventDefault();
    const next = {};
    if (searchInput.trim()) next.search = searchInput.trim();
    if (selectedTag) next.tag = selectedTag;
    setSearchParams(next);
  }

  function selectTag(tag) {
    const next = {};
    if (search) next.search = search;
    if (tag) next.tag = tag;
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
          <Link className="button button-primary" to="/editor">Share an idea <span aria-hidden="true">-&gt;</span></Link>
        </div>
        <div className="hero-aside" aria-label="Community highlights">
          <span className="hero-aside-number">01</span>
          <p>Useful writing<br /><strong>for the next thing</strong></p>
          <span className="hero-aside-line" />
          <p className="hero-aside-note">Fresh perspectives from a growing developer community.</p>
        </div>
      </section>

      <section className="feed-toolbar" aria-label="Explore articles">
        <div>
          <p className="section-label">LATEST FROM THE COMMUNITY</p>
          <h2>Explore ideas</h2>
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
      {!loading && !error && posts.length === 0 && <EmptyState title="No articles found" message="Try another title or topic, or be the first person to publish an idea here." action={<Link className="button button-secondary" to="/editor">Write an article</Link>} />}
      {!loading && !error && posts.length > 0 && <>
        <section className="article-grid" aria-label="Published articles">{posts.map((post, index) => <ArticleCard key={post._id || post.slug} post={post} featured={index === 0} />)}</section>
        {hasNextPage && <div className="load-more-wrap"><button className="button button-secondary" type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading more..." : "Load more articles"}</button></div>}
      </>}
    </div>
  );
}

export default FeedPage;