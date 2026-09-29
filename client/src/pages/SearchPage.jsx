import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ArticleCard from "../components/ArticleCard.jsx";
import { EmptyState, ErrorState, LoadingSkeleton } from "../components/FeedbackStates.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import api from "../services/api.js";

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const [input, setInput] = useState(query);
  const [articles, setArticles] = useState([]);
  const [writers, setWriters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [resultTotals, setResultTotals] = useState({ articles: 0, writers: 0, topics: 0 });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    setInput(query);
    if (!query) {
      setArticles([]);
      setWriters([]);
      setTopics([]);
      setResultTotals({ articles: 0, writers: 0, topics: 0 });
      setErrors([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setErrors([]);
    Promise.allSettled([
      api.get("/api/posts/feed", { params: { search: query, page: 1, limit: 6 } }),
      api.get("/api/users", { params: { search: query, page: 1, limit: 6 } }),
      api.get("/api/tags"),
    ]).then(([articleResult, writerResult, topicResult]) => {
      if (!active) return;
      const nextErrors = [];
      if (articleResult.status === "fulfilled") { setArticles(articleResult.value.data.posts || []); setResultTotals((current) => ({ ...current, articles: articleResult.value.data.total ?? articleResult.value.data.posts?.length ?? 0 })); }
      else { setArticles([]); nextErrors.push("Articles could not be loaded."); }
      if (writerResult.status === "fulfilled") { setWriters(writerResult.value.data.users || []); setResultTotals((current) => ({ ...current, writers: writerResult.value.data.total ?? writerResult.value.data.users?.length ?? 0 })); }
      else { setWriters([]); nextErrors.push("Writer results could not be loaded."); }
      if (topicResult.status === "fulfilled") {
        const normalized = query.toLowerCase();
        const matches = (topicResult.value.data.tags || []).filter((tag) => `${tag.name} ${tag.slug}`.toLowerCase().includes(normalized));
        setTopics(matches.slice(0, 8));
        setResultTotals((current) => ({ ...current, topics: matches.length }));
      } else { setTopics([]); nextErrors.push("Topic results could not be loaded."); }
      setErrors(nextErrors);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  function submit(event) {
    event.preventDefault();
    const value = input.trim();
    setSearchParams(value ? { q: value } : {});
  }

  const hasResults = articles.length || writers.length || topics.length;

  return <div className="page-wrap search-page">
    <header className="search-page-header">
      <p className="eyebrow">FIND YOUR NEXT IDEA</p>
      <h1>Search Hashnode/lab.</h1>
      <p>Look up published articles, writers, and topics across the community.</p>
      <form className="search-form search-page-form" onSubmit={submit} role="search">
        <label className="sr-only" htmlFor="global-search">Search articles, writers, and topics</label>
        <input id="global-search" type="search" placeholder="Try React, accessibility, or a writer name..." value={input} onChange={(event) => setInput(event.target.value)} />
        <button className="button button-dark" type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      </form>
    </header>

    {!query && <EmptyState title="Search the community" message="Search published article titles, public writer names, usernames, and topics." />}
    {query && loading && <LoadingSkeleton count={2} />}
    {query && !loading && errors.length === 3 && <ErrorState message="Search is temporarily unavailable." onRetry={() => setSearchParams({ q: query })} />}
    {query && !loading && errors.length > 0 && errors.length < 3 && <p className="search-partial-error" role="status">Some result types are temporarily unavailable. Showing the results that loaded.</p>}
    {query && !loading && errors.length < 3 && <>
      <p className="search-result-summary">Results for <strong>“{query}”</strong> · {resultTotals.articles} {resultTotals.articles === 1 ? "article" : "articles"}, {resultTotals.writers} {resultTotals.writers === 1 ? "writer" : "writers"}, {resultTotals.topics} {resultTotals.topics === 1 ? "topic" : "topics"}</p>
      {topics.length > 0 && <section className="search-results-section"><div className="section-heading"><p className="section-label">TOPICS</p><h2>Popular topics</h2></div><div className="search-topic-list">{topics.map((topic) => <Link className="search-topic" key={topic._id || topic.slug} to={`/?tag=${encodeURIComponent(topic.name)}`}>#{topic.name}</Link>)}</div></section>}
      {writers.length > 0 && <section className="search-results-section"><div className="section-heading"><p className="section-label">COMMUNITY</p><h2>Writers</h2></div><div className="search-writer-grid">{writers.map((writer) => <Link className="search-writer-card" key={writer.id} to={`/profile/${encodeURIComponent(writer.username)}`}><ProfileAvatar src={writer.avatarUrl} name={writer.name} fallbackName={writer.username} imageClassName="search-writer-avatar-image" fallbackClassName="search-writer-avatar" /><span><strong>{writer.name}</strong><small>@{writer.username}</small>{writer.bio && <small className="search-writer-bio">{writer.bio}</small>}</span><span aria-hidden="true">↗</span></Link>)}</div></section>}
      {articles.length > 0 && <section className="search-results-section"><div className="section-heading"><p className="section-label">PUBLISHED WRITING</p><h2>Articles</h2></div><div className="article-grid">{articles.map((post) => <ArticleCard key={post._id || post.slug} post={post} />)}</div></section>}
      {!hasResults && errors.length === 0 && <EmptyState title="No matches yet" message="Try a broader title, writer name, username, or topic." />}
    </>}
  </div>;
}

export default SearchPage;
