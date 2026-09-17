import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api.js";

const emptyProfile = {
  name: "",
  username: "",
  bio: "",
  avatarUrl: "",
};

function SettingsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/api/users/me");
        if (!active) {
          return;
        }

        const user = response?.data?.user || {};
        setProfile({
          name: user.name || "",
          username: user.username || "",
          bio: user.bio || "",
          avatarUrl: user.avatarUrl || "",
        });
      } catch (err) {
        if (!active) {
          return;
        }

        const message = err?.response?.data?.message || "Unable to load profile settings.";
        setError(message === "Authentication required" ? "Your session is expired or invalid. Please log in again." : message);
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
  }, []);

  async function handleSave(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const { name, username, bio, avatarUrl } = profile;
    const normalizedName = name.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedName) {
      setError("Name is required.");
      return;
    }

    if (!normalizedUsername) {
      setError("Username is required.");
      return;
    }

    const usernameRegex = /^[a-z0-9_][a-z0-9_-]{2,29}$/i;
    if (!usernameRegex.test(normalizedUsername)) {
      setError("Username must start with a letter, number, or underscore and use only letters, numbers, underscores, or hyphens.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.put("/api/users/me", {
        name: normalizedName,
        username: normalizedUsername,
        bio,
        avatarUrl,
      });

      const user = response?.data?.user || {};
      setProfile({
        name: user.name || normalizedName,
        username: user.username || normalizedUsername,
        bio: user.bio || bio,
        avatarUrl: user.avatarUrl || avatarUrl,
      });
      setSuccess("Profile updated successfully.");
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to update profile settings.";
      setError(message === "Authentication required" ? "Your session is expired or invalid. Please log in again." : message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="page-wrap settings-shell"><p className="eyebrow">SETTINGS</p><h1>Loading profile...</h1></div>;
  }

  return (
    <div className="page-wrap settings-page settings-shell">
      <section className="settings-layout">
        <div className="settings-header">
          <div>
            <p className="eyebrow">PROFILE SETTINGS</p>
            <h1>Settings</h1>
          </div>
          <button className="settings-back" type="button" onClick={() => navigate("/dashboard")}>Back to dashboard</button>
        </div>

        {error && <p className="form-message error" role="alert">{error}</p>}
        {success && <p className="form-message success" role="status">{success}</p>}

        <form className="settings-form" onSubmit={handleSave}>
          <label>
            <span>Name</span>
            <input type="text" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required />
          </label>

          <label>
            <span>Username</span>
            <input type="text" value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} required />
          </label>

          <label>
            <span>Bio</span>
            <textarea value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} />
          </label>

          <label>
            <span>Avatar URL</span>
            <input type="url" value={profile.avatarUrl} onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })} />
          </label>

          <div className="settings-actions">
            <button type="button" onClick={() => navigate("/dashboard")}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default SettingsPage;
