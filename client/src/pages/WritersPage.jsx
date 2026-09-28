import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { EmptyState, ErrorState, LoadingSkeleton } from "../components/FeedbackStates.jsx";
import api from "../services/api.js";

function WritersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState("");
  const [error, setError] = useState("");

  async function loadMembers(nextPage = 1, append = false, query = search) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/users", { params: { search: query, page: nextPage, limit: 20 } });
      const result = response.data;
      setMembers((current) => append ? [...current, ...(result.users || [])] : result.users || []);
      setPage(result.page || nextPage);
      setHasNextPage(Boolean(result.hasNextPage));
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load community members.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadMembers(1, false, search);
  }, [search]);

  function handleSearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  async function toggleFollow(member) {
    if (!user) {
      navigate("/login", { state: { from: "/writers" } });
      return;
    }
    if (loadingUserId) return;
    setLoadingUserId(member.id);
    setError("");
    try {
      const method = member.following ? "delete" : "post";
      const response = await api[method](`/api/users/${encodeURIComponent(member.username)}/follow`);
      setMembers((current) => current.map((item) => item.id === member.id ? {
        ...item,
        following: response.data.following,
        followers: response.data.followers,
      } : item));
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to update follow status.");
    } finally {
      setLoadingUserId("");
    }
  }

  return <div className="page-wrap writers-page">
    <header className="writers-header">
      <p className="eyebrow">MEET THE COMMUNITY</p>
      <h1>Find your people.</h1>
      <p>Discover writers, follow their work, and build your circle one connection at a time.</p>
      {!user && <p className="writers-auth-notice">Log in or create an account to follow members. Search by public name or username; email addresses stay private. <Link to="/login" state={{ from: "/writers" }}>Log in</Link> · <Link to="/register">Join the community</Link></p>}
      <form className="search-form writers-search" onSubmit={handleSearch} role="search">
        <label className="sr-only" htmlFor="writer-search">Search members by name or username</label>
        <input id="writer-search" type="search" placeholder="Search by name or username..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <button className="button button-dark" type="submit">Search</button>
      </form>
    </header>

    {!loading && error && <ErrorState message={error} onRetry={() => loadMembers(1, false)} />}
    {loading && <LoadingSkeleton />}
    {!loading && !error && members.length === 0 && <EmptyState title={search ? "No members found" : "You found everyone"} message={search ? "Try a different name or username." : "New community members will show up here as they join."} action={search ? <button className="button button-secondary" type="button" onClick={() => { setSearchInput(""); setSearch(""); }}>Show all writers</button> : null} />}
    {!loading && !error && members.length > 0 && <>
      <p className="writers-result-count">{search ? `Members matching “${search}”` : "Newest members first"}</p>
      <section className="writers-grid" aria-label="Community members">
        {members.map((member) => <article className="writer-card" key={member.id}>
          <Link className="writer-card-profile" to={`/profile/${member.username}`}>
            {member.avatarUrl ? <img className="writer-card-avatar" src={member.avatarUrl} alt="" /> : <span className="writer-card-avatar writer-card-avatar-fallback" aria-hidden="true">{member.name?.slice(0, 1)?.toUpperCase()}</span>}
            <span className="writer-card-identity"><strong>{member.name}</strong><small>@{member.username}</small></span>
          </Link>
          <p className="writer-card-bio">{member.bio || "Developer and community member."}</p>
          {member.followsYou && <span className="writer-follow-back">Follows you</span>}
          <div className="writer-card-footer">
            <span><strong>{member.followers}</strong> followers</span>
            <button className={`button ${member.following ? "button-secondary" : "button-primary"}`} type="button" disabled={loadingUserId === member.id} onClick={() => toggleFollow(member)}>
              {loadingUserId === member.id ? "Updating..." : !user ? "Log in to follow" : member.following ? "Unfollow" : member.followsYou ? "Follow back" : "Follow"}
            </button>
          </div>
        </article>)}
      </section>
      {hasNextPage && <div className="load-more-wrap"><button className="button button-secondary" type="button" disabled={loadingMore} onClick={() => loadMembers(page + 1, true)}>{loadingMore ? "Loading..." : "Load more members"}</button></div>}
    </>}
  </div>;
}

export default WritersPage;
