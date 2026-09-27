import { useState } from "react";

import { mockLogin } from "../services/mockAuth";

function Login() {
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email").trim();
    const password = formData.get("password").trim();

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

    try {
      const response = await mockLogin({
        email,
        password,
      });

      setStatus(`Mock login successful for ${response.user.username}.`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <section>
      <h1>Login</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor='email'>Email</label>
          <input
            type='email'
            id='email'
            name='email'
            placeholder='Enter your email'
          />

          {errors.email && <p>{errors.email}</p>}
        </div>

        <div>
          <label htmlFor='password'>Password</label>
          <input
            type='password'
            id='password'
            name='password'
            placeholder='Enter your password'
          />

          {errors.password && <p>{errors.password}</p>}
        </div>

        <button type='submit'>Login</button>
      </form>

      {status && <p>{status}</p>}
    </section>
  );
}

export default Login;
