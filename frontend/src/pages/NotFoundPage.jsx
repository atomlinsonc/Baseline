import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container" style={{ paddingTop: 'var(--space-16)', textAlign: 'center', maxWidth: 480 }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-4)', marginBottom: 'var(--space-4)' }}>
        404
      </p>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>
        Page not found
      </h1>
      <p style={{ color: 'var(--color-ink-3)', marginBottom: 'var(--space-8)', lineHeight: 1.6 }}>
        This page doesn't exist. Try today's debate or search the archive.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          to="/"
          style={{ fontWeight: 600, padding: '10px 20px', background: 'var(--color-ink)', color: '#fff', textDecoration: 'none', borderRadius: 6 }}
        >
          Today's debate
        </Link>
        <Link
          to="/archive"
          style={{ fontWeight: 600, padding: '10px 20px', border: '1.5px solid var(--color-border-mid)', color: 'var(--color-ink)', textDecoration: 'none', borderRadius: 6 }}
        >
          Archive
        </Link>
      </div>
    </div>
  );
}
