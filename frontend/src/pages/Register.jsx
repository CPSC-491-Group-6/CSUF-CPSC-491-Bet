import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import "../styles/Register.css";

function Register() {
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = formData.get("username").trim();
    const email = formData.get("email").trim();
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");
    const newErrors = {};

    if (!username) {
      newErrors.username = "Username is required.";
    } else if (username.length < 3) {
      newErrors.username = "Username must contain at least 3 characters.";
    }

    if (!email) newErrors.email = "Email is required.";
    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 12) {
      newErrors.password = "Password must contain at least 12 characters.";
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    setStatus("");
    setStatusType("");
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error?.message || "Unable to register. Please try again.",
        );
      }
      setStatus(
        `Registration successful for ${data.user.username}. You can now log in.`,
      );
      setStatusType("success");
      form.reset();
    } catch (error) {
      setStatus(error.message);
      setStatusType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="register-page">
      <div className="register-heading">
        <span className="register-heading-icon" aria-hidden="true">
          <UserPlus size={27} />
        </span>
        <h1>Register</h1>
        <p>
          Create your BET account and start making predictions with friends.
        </p>
      </div>

      <section className="register-card">
        <form onSubmit={handleSubmit} noValidate>
          <div className="register-field">
            <label htmlFor="username">
              <UserRound size={17} aria-hidden="true" />
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              placeholder="Choose a username"
              autoComplete="username"
              aria-invalid={Boolean(errors.username)}
              aria-describedby={
                errors.username ? "register-username-error" : undefined
              }
            />
            {errors.username && (
              <p
                className="register-field-error"
                id="register-username-error"
                role="alert"
              >
                {errors.username}
              </p>
            )}
          </div>

          <div className="register-field">
            <label htmlFor="register-email">
              <Mail size={17} aria-hidden="true" />
              Email
            </label>
            <input
              type="email"
              id="register-email"
              name="email"
              placeholder="Enter your email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={
                errors.email ? "register-email-error" : undefined
              }
            />
            {errors.email && (
              <p
                className="register-field-error"
                id="register-email-error"
                role="alert"
              >
                {errors.email}
              </p>
            )}
          </div>

          <div className="register-field">
            <label htmlFor="register-password">
              <LockKeyhole size={17} aria-hidden="true" />
              Password
            </label>
            <input
              type="password"
              id="register-password"
              name="password"
              placeholder="Create a password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "register-password-error" : undefined
              }
            />
            {errors.password && (
              <p
                className="register-field-error"
                id="register-password-error"
                role="alert"
              >
                {errors.password}
              </p>
            )}
          </div>

          <div className="register-field">
            <label htmlFor="confirmPassword">
              <ShieldCheck size={17} aria-hidden="true" />
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Confirm your password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={
                errors.confirmPassword ? "register-confirm-error" : undefined
              }
            />
            {errors.confirmPassword && (
              <p
                className="register-field-error"
                id="register-confirm-error"
                role="alert"
              >
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="register-submit"
            disabled={isSubmitting}
          >
            <UserPlus size={18} aria-hidden="true" />
            {isSubmitting ? "Registering..." : "Register"}
          </button>
        </form>

        {status && (
          <p
            className={`register-status register-status--${statusType}`}
            role={statusType === "error" ? "alert" : "status"}
          >
            {status}
          </p>
        )}

        <p className="register-footnote">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}

export default Register;
