import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Beaker, Menu, X, Activity, Sun, Moon, KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getReadinessStatus } from '../api/health';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('hecate-theme') || 'light';
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  useEffect(() => {
    // Close mobile menu on route change
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hecate-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const checkHealth = async () => {
      setBackendStatus(await getReadinessStatus());
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard Overview';
    if (path === '/experiments') return 'Experiments';
    if (path === '/experiments/new') return 'Create New Experiment';
    if (path === '/keys') return 'API Keys';
    if (path.includes('/results')) return 'Experiment Results';
    if (path.startsWith('/experiments/')) return 'Experiment Details';
    return 'Hecate';
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">H</div>
          <span className="logo-text">Hecate</span>
          <button 
            className="mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <nav className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          <NavLink 
            to="/" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            end
          >
            <LayoutDashboard size={20} />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/keys" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <KeyRound size={20} /><span>API Keys</span>
          </NavLink>
          <NavLink 
            to="/experiments" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Beaker size={20} />
            <span>Experiments</span>
          </NavLink>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="header-bar">
          <h1 className="header-title">{getPageTitle()}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={toggleTheme}
              className="btn btn-secondary btn-sm"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '0.25rem', 
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
              }}
              aria-label="Toggle Theme"
              data-testid="theme-toggle"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="api-status">
              <Activity size={16} />
              <span>API: </span>
              <div className={`status-dot ${backendStatus.replace(' ', '-')}`} />
              <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                {backendStatus}
              </span>
            </div>
            <span className="user-email">{user?.email}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/login', { replace: true }); }} aria-label="Log out">
              <LogOut size={16} /><span>Log out</span>
            </button>
          </div>
        </header>

        <main className="content-body">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
