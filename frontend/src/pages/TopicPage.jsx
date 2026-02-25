import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import { useFetch } from '../hooks/useFetch.js';
import { formatDate, CATEGORY_LABELS } from '../utils/format.js';
import PollingChart from '../components/PollingChart.jsx';
import ClaimTree from '../components/ClaimTree.jsx';
import './TopicPage.css';

function Section({ id, label, children }) {
  return (
    <section id={id} className="topic-section">
      <div className="topic-section__header">
        <h2 className="topic-section__title">{label}</h2>
      </div>
      <div className="topic-section__body">{children}</div>
    </section>
  );
}

function TrendingExplainer({ topic }) {
  return (
    <div className="trending-explainer">
      <p className="trending-explainer__text">{topic.trending_reason}</p>
      {topic.divisiveness_score > 0 && (
        <div className="divisiveness-meter">
          <div className="divisiveness-meter__label">
            <span className="text-xs text-muted">Divisiveness signal</span>
            <span className="divisiveness-meter__value text-xs">
              {Math.round(topic.divisiveness_score * 100)}/100
            </span>
          </div>
          <div className="divisiveness-meter__track">
            <div
              className="divisiveness-meter__fill"
              style={{ width: `${topic.divisiveness_score * 100}%` }}
            />
          </div>
          <p className="divisiveness-meter__note text-xs text-muted">
            Composite score from Reddit sentiment bimodality, YouTube comment density,
            and cross-platform trending volume.
          </p>
        </div>
      )}
    </div>
  );
}

function TopicNav() {
  return (
    <nav className="topic-nav" aria-label="Topic sections">
      <a href="#why-trending" className="topic-nav__link">Why it's trending</a>
      <a href="#polling" className="topic-nav__link">Polling</a>
      <a href="#arguments" className="topic-nav__link">Arguments</a>
    </nav>
  );
}

function LoadingSkeleton() {
  return (
    <div className="topic-loading" aria-busy="true" aria-label="Loading topic">
      <div className="container">
        <div style={{ paddingTop: 'var(--space-10)' }}>
          {[140, 240, 180, 80, 200, 160].map((w, i) => (
            <div
              key={i}
              className="skeleton-line"
              style={{ width: `${Math.min(w, 100)}%`, maxWidth: w, height: i < 2 ? 28 : 16, marginBottom: 16 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TopicPage() {
  const { slug } = useParams();
  const { data: topic, loading, error } = useFetch(
    () => api.getTopicBySlug(slug),
    [slug]
  );

  if (loading) return <LoadingSkeleton />;

  if (error || !topic) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-16)', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)', color: 'var(--color-ink)' }}>
          Topic not found
        </h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
          {error || "This topic doesn't exist or hasn't been published yet."}
        </p>
        <Link to="/" style={{ fontWeight: 600, color: 'var(--color-ink)', borderBottom: '1px solid var(--color-ink)', textDecoration: 'none', paddingBottom: 1 }}>
          ← Back to today's debate
        </Link>
      </div>
    );
  }

  const catLabel = CATEGORY_LABELS[topic.category] || topic.category;

  return (
    <article className="topic-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="topic-header">
        <div className="container">
          <div className="topic-header__meta">
            <Link to="/archive" className="topic-header__back">← Archive</Link>
            <span className="topic-header__sep" aria-hidden="true">·</span>
            <Link to={`/archive?category=${topic.category}`} className="topic-header__category">
              {catLabel}
            </Link>
            <span className="topic-header__sep" aria-hidden="true">·</span>
            <time className="topic-header__date text-muted" dateTime={topic.date}>
              {formatDate(topic.date)}
            </time>
          </div>

          <h1 className="topic-header__title serif">{topic.title}</h1>
          <p className="topic-header__summary">{topic.summary}</p>

          <TopicNav />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="container topic-body">

        {/* Why it's trending */}
        <Section id="why-trending" label="Why it's trending">
          <TrendingExplainer topic={topic} />
        </Section>

        {/* Polling */}
        <Section id="polling" label="Where Americans stand">
          {topic.polls && topic.polls.length > 0 ? (
            <>
              <p className="topic-section__intro">
                Polling data aggregated from public sources. Numbers show top-line support
                and opposition. Click "Show demographic breakdown" to see party, age, and
                gender splits where available.
              </p>
              <PollingChart polls={topic.polls} />
            </>
          ) : (
            <p className="text-muted text-small">
              No polling data available for this topic.
            </p>
          )}
        </Section>

        {/* Arguments */}
        <Section id="arguments" label="The debate">
          <p className="topic-section__intro">
            The strongest arguments on each side, structured as a claim tree.
            Click any argument to expand its sub-claims and see fact-check verdicts
            aggregated from PolitiFact, FactCheck.org, AP, Reuters, and Snopes.
          </p>
          {topic.arguments && (
            <ClaimTree arguments={topic.arguments} />
          )}
        </Section>

        {/* Methodological note */}
        <section className="topic-note">
          <h3 className="topic-note__title">About this analysis</h3>
          <p className="topic-note__body">
            This topic was selected on {formatDate(topic.date)} based on a divisiveness
            signal measured across Reddit, YouTube, and Google Trends. Arguments were
            generated to represent the strongest mainstream positions on each side.
            Fact-check verdicts are aggregated from multiple independent sources —
            no single fact-checker's rating is definitive. Claims marked{' '}
            <em>Unverifiable</em> are philosophical or values-based and cannot be resolved
            through empirical evidence.
          </p>
          <p className="topic-note__body">
            Baseline does not endorse any position. This is a reference tool, not editorial content.
          </p>
        </section>

        {/* Navigation */}
        <div className="topic-pagination">
          <Link to="/" className="topic-pagination__link">← Today's debate</Link>
          <Link to="/archive" className="topic-pagination__link">Browse archive →</Link>
        </div>

      </div>
    </article>
  );
}
