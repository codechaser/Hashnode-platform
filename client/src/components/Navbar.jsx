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
          <NavLink className="nav-primary" to="/" onClick={closeMenu}>Explore</NavLink>
          <NavLink className="nav-primary" to="/writers" onClick={closeMenu}>Writers</NavLink>
          <NavLink className="nav-primary" to="/pricing" onClick={closeMenu}>{user && !isPro ? "Upgrade" : "Pricing"}</NavLink>
          <NavLink className="nav-primary" to="/search" onClick={closeMenu}>Search</NavLink>
          {user && isPro && <span className="pro-badge">PRO</span>}
          {user && isActivationPending && <span className="activation-badge" role="status">Activating PRO…</span>}
          {user && <NavLink className="nav-visible" to="/editor" onClick={closeMenu}>Write</NavLink>}
          {user && <NavLink className="nav-secondary" to="/dashboard" onClick={closeMenu}>Dashboard</NavLink>}
          {user && <NavLink className="nav-visible nav-notifications" to="/notifications" onClick={closeMenu}>Notifications{unreadNotifications > 0 && <span className="notification-count" aria-label={`${unreadNotifications} unread`}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</NavLink>}
          {user && <NavLink className="nav-avatar" to={profilePath} onClick={closeMenu} aria-label={`Your profile, ${user.name || user.username}`} title="Your profile">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{(user.name || user.username || "U").charAt(0).toUpperCase()}</span>}</NavLink>}
          {user && <NavLink className="nav-secondary" to="/settings" onClick={closeMenu}>Settings</NavLink>}
          {user && <NavLink className="nav-secondary" to="/bookmarks" onClick={closeMenu}>Bookmarks</NavLink>}
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
            <div><p className="eyebrow">HASHNODE/LAB</p><h2 id="more-title">More</h2></div>
            <button ref={moreCloseRef} className="more-close" type="button" aria-label="Close More menu" onClick={closeMore}>×</button>
          </header>
          {user && isActivationPending && <p className="more-activation-status" role="status">Activating PRO… Razorpay confirmation is still pending.</p>}

          <section className="more-group more-products" aria-labelledby="more-products-title">
            <h3 id="more-products-title" className="sr-only">Developer tools</h3>
            <div className="more-products-grid">
              <a className="more-item" href="https://darkshift.dev/" target="_blank" rel="noreferrer"><span className="more-item-icon" aria-hidden="true">▥</span><span><strong>Darkshift <em className="more-new-badge">New</em></strong><small>A dark factory for software.</small></span></a>
              <a className="more-item" href="https://bug0.com/" target="_blank" rel="noreferrer"><span className="more-item-icon" aria-hidden="true">✳</span><span><strong>Bug0</strong><small>The AI-native end-to-end QA regression testing platform.</small></span></a>
              <a className="more-item" href="https://hashnode.com/blog" target="_blank" rel="noreferrer"><span className="more-item-icon" aria-hidden="true">❋</span><span><strong>The foreword</strong><small>Official blog from the Hashnode team.</small></span></a>
              <a className="more-item" href="https://go.bug0.com/passmark" target="_blank" rel="noreferrer"><span className="more-item-icon more-github-icon" aria-hidden="true">●</span><span><strong>Passmark</strong><small>The open-source AI framework for regression testing.</small></span></a>
              <a className="more-item" href="https://github.com/Hashnode/gql-skill" target="_blank" rel="noreferrer"><span className="more-item-icon more-github-icon" aria-hidden="true">●</span><span><strong>Hashnode gql skill</strong><small>Let your AI agent publish to your Hashnode blog.</small></span></a>
            </div>
          </section>

          <section className="more-group more-footer-links" aria-label="More links">
            <a href="mailto:hello+support@hashnode.com">♧ &nbsp;Support</a>
            <a href="https://hashnode.com/changelog" target="_blank" rel="noreferrer">Changelog</a>
            <a href="https://hashnode.com/brand" target="_blank" rel="noreferrer">Brand</a>
            <a href="https://hashnode.com/sitemap.xml" target="_blank" rel="noreferrer">Sitemap</a>
            <a href="https://hashnode.com/code-of-conduct" target="_blank" rel="noreferrer">Code of Conduct</a>
            <Link to="/writers" onClick={closeMore}>Find writers</Link>
            <Link to="/search" onClick={closeMore}>Search articles and writers</Link>
            <Link to="/" onClick={closeMore}>Explore feed</Link>
            <Link to="/pricing" onClick={closeMore}>{isPro ? "PRO plan" : "Explore PRO"}</Link>
            {user && <Link to="/editor" onClick={closeMore}>Write an article</Link>}
            {user && <Link to="/dashboard" onClick={closeMore}>Creator dashboard</Link>}
            {user && <Link to={profilePath} onClick={closeMore}>Profile</Link>}
            {user && <Link to="/settings" onClick={closeMore}>Settings</Link>}
            {user && <Link to="/bookmarks" onClick={closeMore}>Saved reads</Link>}
            {user && <Link to="/notifications" onClick={closeMore}>Notifications{unreadNotifications > 0 && <span className="more-unread"> ({unreadNotifications > 99 ? "99+" : unreadNotifications} new)</span>}</Link>}
          </section>
          <footer className="more-panel-footer">
            <a href="https://x.com/hashnode" target="_blank" rel="noreferrer" aria-label="Hashnode on X">𝕏</a>
            <a href="https://www.linkedin.com/company/hashnode/" target="_blank" rel="noreferrer" aria-label="Hashnode on LinkedIn">in</a>
            <a href="https://hashnode.com/terms" target="_blank" rel="noreferrer">Terms</a>
            <a href="https://hashnode.com/privacy-policy" target="_blank" rel="noreferrer">Privacy</a>
            <a className="more-source-link" href="https://github.com/codechaser/Hashnode-platform" target="_blank" rel="noreferrer">Hashnode Lab source</a>
          </footer>
        </aside>
      </div>, document.body)}
    </header>
  );
}

export default Navbar;
