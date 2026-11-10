import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, LogIn, Mail } from "lucide-react";
import { useAuth } from "../context/useAuth";
import "../styles/Login.css";

function Login() {
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email").trim();
    const password = formData.get("password");
    const newErrors = {};

    if (!email) newErrors.email = "Email is required.";
    if (!password) newErrors.password = "Password is required.";
    setErrors(newErrors);
    setStatus("");
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error?.message || "Unable to log in. Please try again.",
        );
      }
      login(data.user);
      setStatus(`Login successful. Welcome, ${data.user.username}.`);
      navigate("/profile");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-heading">
        <span className="login-heading-icon" aria-hidden="true">
          <LogIn size={27} />
        </span>
        <h1>Login</h1>
        <p>Welcome back to BET. Sign in to manage your bets.</p>
      </div>

      <section className="login-card">
        <form onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="email">
              <Mail size={17} aria-hidden="true" />
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="Enter your email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
            />
            {errors.email && (
              <p
                id="login-email-error"
                className="login-field-error"
                role="alert"
              >
                {errors.email}
              </p>
            )}
          </div>

          <div className="login-field">
            <label htmlFor="password">
              <LockKeyhole size={17} aria-hidden="true" />
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "login-password-error" : undefined
              }
            />
            {errors.password && (
              <p
                id="login-password-error"
                className="login-field-error"
                role="alert"
              >
                {errors.password}
              </p>
            )}
          </div>

          <button
            className="login-submit"
            type="submit"
            disabled={isSubmitting}
          >
            <LogIn size={18} aria-hidden="true" />
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        {status && (
          <p className="login-status" role="alert">
            {status}
          </p>
        )}

        <p className="login-footnote">
          Don't have an account? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}

export default Login;
