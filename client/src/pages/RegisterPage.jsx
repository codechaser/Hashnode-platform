import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api.js";

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();

    if (!name || !email || !form.password) {
      setError("Name, email, and password are required.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await api.post("/api/auth/register", { name, email, password: form.password });
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-wrap auth-page">
      <section className="auth-panel" aria-labelledby="register-title">
        <p className="eyebrow">JOIN THE COMMUNITY</p>
        <h1 id="register-title">Create your account</h1>
        <p className="auth-intro">Make a home for useful ideas and thoughtful writing.</p>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              autoComplete="name"
              required
            />
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </div>
  );
}

export default RegisterPage;