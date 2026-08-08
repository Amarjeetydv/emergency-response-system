import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // Basic Validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 6;
  const isFormValid = email !== '' && isEmailValid && password !== '' && isPasswordValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await login({ email, password });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(
        err?.response?.data?.message || err?.message || 'Invalid email or password'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>Welcome Back</h2>
      <p className="subtitle">Please login to your account</p>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="email-input">Email Address</label>
        <input
          id="email-input"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
        />
        {email && !isEmailValid && (
          <div className="error-text">
            <small>Enter a valid email address</small>
          </div>
        )}

        <label htmlFor="password-input">Password</label>
        <input
          id="password-input"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        {password && !isPasswordValid && (
          <div className="error-text">
            <small>Minimum 6 characters required</small>
          </div>
        )}

        <button type="submit" disabled={!isFormValid || isSubmitting}>
          {isSubmitting ? <span>Authenticating...</span> : <span>Sign In</span>}
        </button>
      </form>

      <p className="footer-text">
        Don't have an account? <Link to="/register">Register here</Link>
      </p>
    </div>
  );
};

export default Login;
