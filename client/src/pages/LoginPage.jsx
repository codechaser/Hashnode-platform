import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, navigate, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    const email = form.email.trim();

    if (!email || !form.password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await api.post("/api/auth/login", { email, password: form.password });
      const token = response?.data?.token;

      if (!token) {
        setError("Login succeeded without a session token. Please try again.");
        return;
      }

      await login(token, response?.data?.user);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      const networkMessage = err?.request && !err?.response
        ? "Unable to reach the API. Make sure the backend is running on port 5000."
        : "Unable to log in. Please try again.";
      setError(apiMessage || networkMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-wrap auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow">WELCOME BACK</p>
        <h1 id="login-title">Log in to Hashnode</h1>
        <p className="auth-intro">Continue writing and reading ideas worth keeping.</p>

        {location.state?.registered && (
          <p className="auth-success" role="status">Account created. You can log in now.</p>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              required
            />
          </label>

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          New to Hashnode? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </div>
  );
}

export default LoginPage;