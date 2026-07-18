import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const { login, signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ mode: 'onBlur' });
  const destination = location.state?.from?.pathname || '/';

  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async ({ email, password }) => {
    setServerError('');
    try {
      if (isSignup) {
        await signup({ email, password });
        navigate('/login', { replace: true, state: { notice: 'Account created. Log in to access the dashboard and create SDK keys.' } });
      } else {
        await login({ email, password });
        navigate(destination, { replace: true });
      }
    } catch (error) {
      setServerError(error.details?.message || error.details?.error_message || error.message);
    }
  };

  return (
    <main className="auth-page"><section className="auth-card">
      <div className="logo-icon">H</div><h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="page-subtitle">{isSignup ? 'Create an account to manage your experiments.' : 'Log in to your Hecate dashboard.'}</p>
      {location.state?.notice && <div className="alert alert-success" role="status"><div className="alert-message">{location.state.notice}</div></div>}
      {serverError && <div className="alert alert-danger" role="alert"><AlertCircle size={20} /><div className="alert-message">{serverError}</div></div>}
      <form onSubmit={handleSubmit(submit)}>
        <div className="form-group"><label className="form-label" htmlFor="email">Email</label>
          <input id="email" className="form-input" type="email" autoComplete="email" {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' } })} />
          {errors.email && <p className="form-error">{errors.email.message}</p>}</div>
        <div className="form-group"><label className="form-label" htmlFor="password">Password</label>
          <input id="password" className="form-input" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Password must be at least 8 characters' } })} />
          {errors.password && <p className="form-error">{errors.password.message}</p>}</div>
        <button className="btn btn-primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait...' : isSignup ? 'Create account' : 'Log in'}</button>
      </form>
      <p className="auth-switch">{isSignup ? 'Already have an account?' : 'Need an account?'} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Log in' : 'Sign up'}</Link></p>
    </section></main>
  );
}
