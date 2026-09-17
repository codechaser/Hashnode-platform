import { useLocation } from "react-router-dom";

function PlaceholderPage() {
  const location = useLocation();
  const title = location.pathname === "/login"
    ? "Log in"
    : location.pathname === "/register"
      ? "Create your account"
      : location.pathname === "/editor"
        ? "Editor"
        : location.pathname.startsWith("/editor/")
          ? "Editor"
          : location.pathname === "/dashboard"
            ? "Dashboard"
            : location.pathname.startsWith("/profile/")
              ? "Public profile"
              : location.pathname === "/settings"
                ? "Profile settings"
                : "Page not found";

  return (
    <div className="page-wrap placeholder-page">
      <p className="eyebrow">HASHNODE / NEXT</p>
      <h1>{title}</h1>
      <p>This route is scaffolded for the next product checkpoint.</p>
    </div>
  );
}

export default PlaceholderPage;