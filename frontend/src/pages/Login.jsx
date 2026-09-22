function Login() {
  const handleSubmit = (event) => {
    event.preventDefault();
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
        </div>

        <div>
          <label htmlFor='password'>Password</label>
          <input
            type='password'
            id='password'
            name='password'
            placeholder='Enter your password'
          />
        </div>

        <button type='submit'>Login</button>
      </form>
    </section>
  );
}

export default Login;
