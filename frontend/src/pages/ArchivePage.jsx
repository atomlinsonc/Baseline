import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { useFetch } from '../hooks/useFetch.js';
import TopicCard from '../components/TopicCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import './ArchivePage.css';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'social-issues',      label: 'Social Issues' },
  { value: 'economic-policy',    label: 'Economic Policy' },
  { value: 'foreign-policy',     label: 'Foreign Policy' },
  { value: 'civil-rights',       label: 'Civil Rights' },
  { value: 'science-technology', label: 'Science & Technology' },
  { value: 'religion',           label: 'Religion & Values' },
  { value: 'healthcare',         label: 'Healthcare' },
  { value: 'immigration',        label: 'Immigration' },
  { value: 'education',          label: 'Education' },
  { value: 'environment',        label: 'Environment' },
];

export default function ArchivePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [page, setPage] = useState(1);

  // Sync state back to URL
  useEffect(() => {
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [q, category, page, setSearchParams]);

  const { data: result, loading, error } = useFetch(
    () => api.listTopics({ q: q || undefined, category: category || undefined, page, limit: 20 }),
    [q, category, page]
  );

  const handleSearch = useCallback((query) => {
    setQ(query);
    setPage(1);
  }, []);

  const handleCategory = useCallback((cat) => {
    setCategory(cat);
    setPage(1);
  }, []);

  const { items = [], total = 0, totalPages = 1 } = result || {};

  return (
    <div className="archive-page">
      <div className="container">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="archive-header">
          <h1 className="archive-header__title">Archive</h1>
          <p className="archive-header__subtitle text-muted">
            Every debate published, searchable by keyword and category.
            {total > 0 && ` ${total} topic${total !== 1 ? 's' : ''} published.`}
          </p>
        </header>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="archive-filters">
          <SearchBar onSearch={handleSearch} initialValue={q} />

          <div className="archive-filters__categories" role="group" aria-label="Filter by category">
            {CATEGORY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`archive-cat-btn${category === opt.value ? ' is-active' : ''}`}
                onClick={() => handleCategory(opt.value)}
                aria-pressed={category === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Active filters display ────────────────────────────────────────── */}
        {(q || category) && (
          <div className="archive-active-filters">
            <span className="text-small text-muted">Filtering by: </span>
            {q && (
              <span className="archive-filter-chip">
                "{q}"
                <button onClick={() => handleSearch('')} aria-label="Remove search filter">×</button>
              </span>
            )}
            {category && (
              <span className="archive-filter-chip">
                {CATEGORY_OPTIONS.find(o => o.value === category)?.label}
                <button onClick={() => handleCategory('')} aria-label="Remove category filter">×</button>
              </span>
            )}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        <div className="archive-results">
          {loading && (
            <div className="archive-loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="archive-skeleton">
                  <div className="archive-skeleton__meta" />
                  <div className="archive-skeleton__title" />
                  <div className="archive-skeleton__body" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="archive-message text-muted">
              Could not load topics: {error}
            </p>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="archive-empty">
              <p className="archive-message">
                {q || category
                  ? 'No topics match your filters. Try different keywords or clear the filters.'
                  : 'No topics have been published yet. Check back tomorrow!'}
              </p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="archive-list">
                {items.map(topic => (
                  <TopicCard key={topic.slug} topic={topic} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="archive-pagination">
                  <button
                    className="archive-pagination__btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ← Previous
                  </button>
                  <span className="text-small text-muted">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className="archive-pagination__btn"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
