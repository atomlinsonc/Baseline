import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="site-wrapper">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="site-header__logo">
            <span className="site-header__wordmark">Baseline</span>
            <span className="site-header__tagline">America's daily debate dashboard</span>
          </Link>
          <nav className="site-header__nav" aria-label="Main navigation">
            <Link
              to="/"
              className={`site-header__nav-link${pathname === '/' ? ' is-active' : ''}`}
            >
              Today
            </Link>
            <Link
              to="/archive"
              className={`site-header__nav-link${pathname.startsWith('/archive') ? ' is-active' : ''}`}
            >
              Archive
            </Link>
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <p className="site-footer__statement">
            Baseline publishes one debate topic per day. Topics are selected algorithmically
            by divisiveness signal, then analyzed using publicly available polling data and
            aggregated fact-checker sources. No editorial endorsement is implied.
          </p>
          <p className="site-footer__note text-muted text-small">
            Read-only. No accounts. No comments. No ads.
          </p>
        </div>
      </footer>
    </div>
  );
}
