import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import ArticleCard from "../../components/ArticleCard.jsx";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/FeedbackStates.jsx";
import api from "../../services/api.js";

function ProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followState, setFollowState] = useState({ following: false, followers: 0, followingCount: 0 });
  const [followLoading, setFollowLoading] = useState(false);
  const [connections, setConnections] = useState(null);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/api/users/${username}`);
        if (active) {
          setProfile(response.data);
          const status = await api.get(`/api/users/${encodeURIComponent(username)}/follow-status`);
          if (active) setFollowState(status.data);
        }
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.message || "Profile not found");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [username]);

  const isOwnProfile = currentUser?.username?.toLowerCase() === profile?.user?.username?.toLowerCase();

  async function toggleFollow() {
    if (!currentUser) {
      navigate("/login", { state: { from: `/profile/${username}` } });
      return;
    }
    if (followLoading || isOwnProfile) return;
    setFollowLoading(true);
    setError("");
    try {
      const method = followState.following ? "delete" : "post";
      const response = await api[method](`/api/users/${encodeURIComponent(username)}/follow`);
      setFollowState(response.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to update follow status.");
    } finally {
      setFollowLoading(false);
    }
  }

  async function openConnections(type) {
    setConnections({ type, items: [], page: 1, hasNextPage: false });
    setConnectionsLoading(true);
    setConnectionsError("");
    try {
      const response = await api.get(`/api/users/${encodeURIComponent(username)}/${type}`, { params: { page: 1, limit: 20 } });
      setConnections({ type, ...response.data });
    } catch (err) {
      setConnectionsError(err?.response?.data?.message || "Unable to load this list.");
    } finally {
      setConnectionsLoading(false);
    }
  }

  if (loading) {
    return <div className="page-wrap"><LoadingSkeleton count={1} /></div>;
  }

  if (error || !profile?.user) {
    return <div className="page-wrap"><ErrorState message={error || "Profile not found"} /></div>;
  }

  const { user, posts = [] } = profile;

  return (
    <div className="page-wrap profile-page">
      <section className="profile-hero">
        <div className="profile-heading">
          {user.avatarUrl ? <img className="profile-avatar" src={user.avatarUrl} alt={`${user.name} avatar`} /> : <span className="avatar">{user.name?.[0] || "U"}</span>}
          <div>
            <p className="eyebrow">PUBLIC PROFILE</p>
            <h1>{user.name}</h1>
            <p className="profile-username">@{user.username}</p>
            <p className="profile-bio">{user.bio || "No bio yet."}</p>
          </div>
        </div>
        <div className="profile-actions">
          {!isOwnProfile && <button className="button button-primary" type="button" disabled={followLoading} onClick={toggleFollow}>{followLoading ? "Updating..." : followState.following ? "Unfollow" : "Follow"}</button>}
          <div className="profile-stats">
            <button type="button" onClick={() => openConnections("followers")}><strong>{followState.followers ?? user.followers ?? 0}</strong> Followers</button>
            <button type="button" onClick={() => openConnections("following")}><strong>{followState.followingCount ?? user.following ?? 0}</strong> Following</button>
          </div>
        </div>
      </section>
      {error && <p className="form-message error" role="alert">{error}</p>}

      {connections && <div className="connection-backdrop" role="presentation" onClick={() => setConnections(null)}>
        <section className="connection-dialog" role="dialog" aria-modal="true" aria-labelledby="connection-title" onClick={(event) => event.stopPropagation()}>
        <div className="connection-dialog-header">
          <h2 id="connection-title">{connections.type === "followers" ? "Followers" : "Following"}</h2>
          <button className="action-button" type="button" onClick={() => setConnections(null)} aria-label="Close">Close</button>
        </div>
        {connectionsLoading && <LoadingSkeleton count={2} />}
        {connectionsError && <ErrorState message={connectionsError} />}
        {!connectionsLoading && !connectionsError && (connections.items || []).map((person) => <a className="connection-row" key={person._id} href={`/profile/${person.username}`}><span className="avatar avatar-small">{person.name?.[0] || "U"}</span><span><strong>{person.name}</strong><small>@{person.username}</small></span></a>)}
        {!connectionsLoading && !connectionsError && !connections.items?.length && <p className="connection-empty">No connections yet.</p>}
        </section>
      </div>}

      <section className="profile-posts">
        <div className="profile-posts-heading">
          <p className="eyebrow">PUBLISHED ARTICLES</p>
          <span className="post-count">{posts.length}</span>
        </div>

        {posts.length === 0 ? (
          <EmptyState title="No published articles yet" message="This writer has not shared an article yet." />
        ) : (
          <div className="article-grid">{posts.map((post) => <ArticleCard key={post.slug} post={{ ...post, author: user }} />)}</div>
        )}
      </section>
    </div>
  );
}

export default ProfilePage;
