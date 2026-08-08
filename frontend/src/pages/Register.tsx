import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api/authApi';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('citizen');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  // Basic Validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 6;
  const passwordsMatch = password === confirmPassword;
  const isFormValid =
    name.trim() !== '' &&
    email !== '' &&
    isEmailValid &&
    password !== '' &&
    isPasswordValid &&
    confirmPassword !== '' &&
    passwordsMatch &&
    role !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    const registrationData = {
      name,
      email,
      password,
      role,
    };

    try {
      await authApi.register(registrationData);
      setErrorMessage('');
      setSuccessMessage('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMessage(
        err?.response?.data?.message || err?.message || 'Registration failed. Try again.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>Create Account</h2>
      <p className="subtitle">Join the emergency response system</p>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}
      {successMessage && <div className="success-banner">{successMessage}</div>}

      {/* Hide form on success to focus on the message */}
      {!successMessage && (
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="name-input">Full Name</label>
          <input
            id="name-input"
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            required
          />
          {name && name.trim() === '' && (
            <div className="error-text">
              <small>Name is required</small>
            </div>
          )}

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

          <label htmlFor="confirm-password-input">Confirm Password</label>
          <input
            id="confirm-password-input"
            type="password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {confirmPassword && !passwordsMatch && (
            <div className="error-text">
              <small>Passwords do not match</small>
            </div>
          )}

          <label htmlFor="role-select">Role</label>
          <select
            id="role-select"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            <option value="citizen">Citizen</option>
            <option value="police">Police Responder</option>
            <option value="fire">Fire Responder</option>
            <option value="ambulance">Ambulance Responder</option>
          </select>

          <button type="submit" disabled={!isFormValid || isSubmitting}>
            {isSubmitting ? <span>Creating account...</span> : <span>Register</span>}
          </button>
        </form>
      )}

      <p className="footer-text">
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
};

export default Register;
