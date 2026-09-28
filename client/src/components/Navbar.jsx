import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useSubscription } from "../context/SubscriptionContext.jsx";
import api from "../services/api.js";

function Navbar() {
  const { user, logout } = useAuth();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const { isPro, isActivationPending } = useSubscription();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const moreTriggerRef = useRef(null);
  const moreCloseRef = useRef(null);
  const morePanelRef = useRef(null);
  const profilePath = user?.username ? `/profile/${user.username}` : "/settings";
  const closeMenu = () => setMenuOpen(false);
  const nextPreference = preference === "system" ? "light" : preference === "light" ? "dark" : "system";
  const themeLabel = preference === "system" ? `Theme: System (${resolvedTheme})` : `Theme: ${preference}`;
  const closeMore = () => {
    setMoreOpen(false);
    moreTriggerRef.current?.focus();
  };
  const openMore = () => {
    setMenuOpen(false);
    setMoreOpen(true);
  };

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      return undefined;
    }

    let active = true;
    const loadUnreadCount = async () => {
      try {
        const response = await api.get("/api/notifications", { params: { page: 1, limit: 1 } });
        if (active) setUnreadNotifications(response.data.unreadCount || 0);
      } catch {
        // Keep navigation usable when notifications are temporarily unavailable.
      }
    };
    loadUnreadCount();
    const timer = window.setInterval(loadUnreadCount, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    moreCloseRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        closeMore();
      }
      if (event.key === "Tab") {
        const focusable = morePanelRef.current?.querySelectorAll('a[href], button:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

  return (
    <header className="site-header">
      <div className="nav-inner">
        <a className="brand" href="/" onClick={closeMenu} aria-label="Hashnode Lab">
          hashnode<span>/lab</span>
        </a>
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>
          <span className="sr-only">Toggle navigation</span><span /><span /><span />
        </button>
        <nav id="primary-navigation" className={`site-nav ${menuOpen ? "is-open" : ""}`} aria-label="Primary navigation">
          <NavLink to="/" onClick={closeMenu}>Explore</NavLink>
          <NavLink to="/writers" onClick={closeMenu}>Writers</NavLink>
          <NavLink to="/pricing" onClick={closeMenu}>{user && !isPro ? "Upgrade" : "Pricing"}</NavLink>
          {user && isPro && <span className="pro-badge">PRO</span>}
          {user && isActivationPending && <span className="activation-badge" role="status">Activating PRO…</span>}
          {user && <NavLink className="nav-create" to="/editor" onClick={closeMenu}>Write</NavLink>}
          {user && <NavLink to="/dashboard" onClick={closeMenu}>Dashboard</NavLink>}
          {user && <NavLink className="nav-notifications" to="/notifications" onClick={closeMenu}>Notifications{unreadNotifications > 0 && <span className="notification-count" aria-label={`${unreadNotifications} unread`}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</NavLink>}
          {user && <NavLink to={profilePath} onClick={closeMenu}>Profile</NavLink>}
          {user && <NavLink to="/settings" onClick={closeMenu}>Settings</NavLink>}
          {user && <NavLink to="/bookmarks" onClick={closeMenu}>Bookmarks</NavLink>}
          <button ref={moreTriggerRef} className={`nav-more ${moreOpen ? "active" : ""}`} type="button" aria-haspopup="dialog" aria-expanded={moreOpen} aria-controls="more-panel" onClick={openMore}>More <span aria-hidden="true">•••</span></button>
          <button
            className="theme-toggle"
            type="button"
            aria-label={`${themeLabel}. Switch to ${nextPreference} theme`}
            title={themeLabel}
            onClick={() => setPreference(nextPreference)}
          >
            <span aria-hidden="true">{resolvedTheme === "dark" ? "☾" : "☀"}</span>
            <span>{preference === "system" ? "System" : resolvedTheme === "dark" ? "Dark" : "Light"}</span>
          </button>
          {user ? <button className="nav-logout" type="button" onClick={() => { logout(); closeMenu(); }}>Log out</button> : (
            <div className="nav-auth-links"><NavLink to="/login" onClick={closeMenu}>Log in</NavLink><NavLink className="button button-small" to="/register" onClick={closeMenu}>Get started</NavLink></div>
          )}
        </nav>
      </div>
      {moreOpen && createPortal(<div className="more-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMore(); }}>
        <aside ref={morePanelRef} id="more-panel" className="more-panel" role="dialog" aria-modal="true" aria-labelledby="more-title">
          <header className="more-panel-header">
            <div><p className="eyebrow">HASHNODE/LAB</p><h2 id="more-title">More to explore</h2></div>
            <button ref={moreCloseRef} className="more-close" type="button" aria-label="Close More menu" onClick={closeMore}>×</button>
          </header>

          <section className="more-group" aria-labelledby="more-community-title">
            <h3 id="more-community-title">Community</h3>
            <Link className="more-item" to="/writers" onClick={closeMore}><span className="more-item-icon" aria-hidden="true">⌖</span><span><strong>Find writers</strong><small>Discover members and follow their work.</small></span><span className="more-arrow" aria-hidden="true">↗</span></Link>
            <Link className="more-item" to="/" onClick={closeMore}><span className="more-item-icon" aria-hidden="true">▤</span><span><strong>Explore the feed</strong><small>Read articles and find trending topics.</small></span><span className="more-arrow" aria-hidden="true">↗</span></Link>
            {user && <Link className="more-item" to="/notifications" onClick={closeMore}><span className="more-item-icon" aria-hidden="true">♧</span><span><strong>Notifications</strong><small>New followers, reactions, and comments.</small></span>{unreadNotifications > 0 && <span className="more-unread">{unreadNotifications > 99 ? "99+" : unreadNotifications} new</span>}</Link>}
          </section>

          <section className="more-group" aria-labelledby="more-workspace-title">
            <h3 id="more-workspace-title">Your workspace</h3>
            {user ? <>
              <Link className="more-item" to="/editor" onClick={closeMore}><span className="more-item-icon" aria-hidden="true">✎</span><span><strong>Write an article</strong><small>Draft, preview, and publish a post.</small></span><span className="more-arrow" aria-hidden="true">↗</span></Link>
              <Link className="more-item" to="/dashboard" onClick={closeMore}><span className="more-item-icon" aria-hidden="true">▥</span><span><strong>Creator dashboard</strong><small>Manage your articles and creator tools.</small></span><span className="more-arrow" aria-hidden="true">↗</span></Link>
              <Link className="more-item" to="/bookmarks" onClick={closeMore}><span className="more-item-icon" aria-hidden="true">▱</span><span><strong>Saved reads</strong><small>Return to articles you bookmarked.</small></span><span className="more-arrow" aria-hidden="true">↗</span></Link>
            </> : <Link className="more-item" to="/login" state={{ from: "/writers" }} onClick={closeMore}><span className="more-item-icon" aria-hidden="true">↪</span><span><strong>Sign in to get started</strong><small>Follow writers, save articles, and publish.</small></span><span className="more-arrow" aria-hidden="true">↗</span></Link>}
            <Link className="more-item" to="/pricing" onClick={closeMore}><span className="more-item-icon more-pro-icon" aria-hidden="true">◇</span><span><strong>{isPro ? "PRO creator plan" : "Explore PRO"}</strong><small>See the creator tools and plan details.</small></span><span className="more-arrow" aria-hidden="true">↗</span></Link>
          </section>

          <section className="more-group more-project-group" aria-labelledby="more-project-title">
            <h3 id="more-project-title">About this project</h3>
            <a className="more-item" href="https://github.com/codechaser/Hashnode-platform" target="_blank" rel="noreferrer"><span className="more-item-icon" aria-hidden="true">⌘</span><span><strong>Open source on GitHub</strong><small>View the project source and implementation.</small></span><span className="more-arrow" aria-hidden="true">↗</span></a>
          </section>
          <footer className="more-panel-footer">Write, share, and grow with the developer community.</footer>
        </aside>
      </div>, document.body)}
    </header>
  );
}

export default Navbar;
