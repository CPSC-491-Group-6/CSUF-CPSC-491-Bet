import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";

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

    if (!email) {
      newErrors.email = "Email is required.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    }

    setErrors(newErrors);
    setStatus("");

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
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
    <section>
      <h1>Login</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
          />

          {errors.email && <p>{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Enter your password"
          />

          {errors.password && <p>{errors.password}</p>}
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>

      {status && <p>{status}</p>}
    </section>
  );
}

export default Login;