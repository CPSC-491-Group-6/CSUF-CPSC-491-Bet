import { useState } from "react";

function Register() {
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
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

    if (!email) {
      newErrors.email = "Email is required.";
    }

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

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          email,
          password,
        }),
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

      form.reset();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <h1>Register</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            placeholder="Choose a username"
          />

          {errors.username && <p>{errors.username}</p>}
        </div>

        <div>
          <label htmlFor="register-email">Email</label>
          <input
            type="email"
            id="register-email"
            name="email"
            placeholder="Enter your email"
          />

          {errors.email && <p>{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="register-password">Password</label>
          <input
            type="password"
            id="register-password"
            name="password"
            placeholder="Create a password"
          />

          {errors.password && <p>{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm your password"
          />

          {errors.confirmPassword && <p>{errors.confirmPassword}</p>}
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registering..." : "Register"}
        </button>
      </form>

      {status && <p>{status}</p>}
    </section>
  );
}

export default Register;