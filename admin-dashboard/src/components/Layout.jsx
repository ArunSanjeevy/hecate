import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Beaker, Menu, X, Activity } from 'lucide-react';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // checking, online, offline
  const location = useLocation();

  useEffect(() => {
    // Close mobile menu on route change
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const checkHealth = async () => {
      const url = import.meta.env.VITE_HECATE_API_URL || 'http://localhost:4000';
      try {
        const res = await fetch(`${url.replace(/\/$/, '')}/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok') {
            setBackendStatus('online');
            return;
          }
        }
        setBackendStatus('offline');
      } catch {
        setBackendStatus('offline');
      }
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
          <div className="api-status">
            <Activity size={16} />
            <span>API: </span>
            <div className={`status-dot ${backendStatus === 'online' ? 'online' : 'offline'}`} />
            <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
              {backendStatus}
            </span>
          </div>
        </header>

        <main className="content-body">
          {children}
        </main>
      </div>
    </div>
  );
}
