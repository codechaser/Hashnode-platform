import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useSubscription } from "../context/SubscriptionContext.jsx";

function Navbar() {
  const { user, logout } = useAuth();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const { isPro } = useSubscription();
  const [menuOpen, setMenuOpen] = useState(false);
  const profilePath = user?.username ? `/profile/${user.username}` : "/settings";
  const closeMenu = () => setMenuOpen(false);
  const nextPreference = preference === "system" ? "light" : preference === "light" ? "dark" : "system";
  const themeLabel = preference === "system" ? `Theme: System (${resolvedTheme})` : `Theme: ${preference}`;

  return (
    <header className="site-header">
      <div className="nav-inner">
        <NavLink className="brand" to="/" onClick={closeMenu}>hashnode<span>/lab</span></NavLink>
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>
          <span className="sr-only">Toggle navigation</span><span /><span /><span />
        </button>
        <nav id="primary-navigation" className={`site-nav ${menuOpen ? "is-open" : ""}`} aria-label="Primary navigation">
          <NavLink to="/" onClick={closeMenu}>Explore</NavLink>
          <NavLink to="/pricing" onClick={closeMenu}>{user && !isPro ? "Upgrade" : "Pricing"}</NavLink>
          {user && isPro && <span className="pro-badge">PRO</span>}
          {user && <NavLink className="nav-create" to="/editor" onClick={closeMenu}>Write</NavLink>}
          {user && <NavLink to="/dashboard" onClick={closeMenu}>Dashboard</NavLink>}
          {user && <NavLink to={profilePath} onClick={closeMenu}>Profile</NavLink>}
          {user && <NavLink to="/settings" onClick={closeMenu}>Settings</NavLink>}
          {user && <NavLink to="/bookmarks" onClick={closeMenu}>Bookmarks</NavLink>}
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
    </header>
  );
}

export default Navbar;