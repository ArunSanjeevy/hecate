import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/auth/AuthContext';
import { useAuth } from '../src/auth/AuthContext';
import AuthPage from '../src/pages/AuthPage';
import ProtectedRoute from '../src/auth/ProtectedRoute';
import { apiClient } from '../src/api/client';

vi.mock('../src/api/client', () => ({ apiClient: { login: vi.fn(), signup: vi.fn() }, setAuthToken: vi.fn(), setUnauthorizedHandler: vi.fn() }));
const wrap = ({ children }) => <MemoryRouter><AuthProvider>{children}</AuthProvider></MemoryRouter>;
function LogoutControl() { const { logout } = useAuth(); return <button onClick={logout}>Log out</button>; }

describe('authentication screens and routing', () => {
  beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });
  it('logs in and saves the current-session token', async () => {
    apiClient.login.mockResolvedValue({ token: 'jwt-token', user: { email: 'me@example.com' } });
    render(<AuthPage mode="login" />, { wrapper: wrap });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'me@example.com'); await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(sessionStorage.getItem('hecate-dashboard-session')).toContain('jwt-token'));
  });
  it('directs a new user to log in before creating an SDK key', async () => {
    apiClient.signup.mockResolvedValue({ user: { email: 'me@example.com' } });
    render(<AuthPage mode="signup" />, { wrapper: wrap });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'me@example.com'); await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/Account created/i)).toBeInTheDocument();
  });
  it('redirects unauthenticated protected routes to login', () => {
    render(<Routes><Route element={<ProtectedRoute />}><Route path="/" element={<div>Private</div>} /></Route><Route path="/login" element={<div>Login screen</div>} /></Routes>, { wrapper: wrap });
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });
  it('logs out by clearing the browser-session token', async () => {
    sessionStorage.setItem('hecate-dashboard-session', JSON.stringify({ token: 'jwt', user: { email: 'me@example.com' } }));
    render(<LogoutControl />, { wrapper: wrap });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
    expect(sessionStorage.getItem('hecate-dashboard-session')).toBeNull();
  });
});
