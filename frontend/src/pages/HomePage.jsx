import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import { useFetch } from '../hooks/useFetch.js';
import TopicCard from '../components/TopicCard.jsx';
import './HomePage.css';

function LoadingHero() {
  return (
    <div className="homepage-hero homepage-hero--loading" aria-busy="true">
      <div className="skeleton skeleton--cat" />
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--title skeleton--title-2" />
      <div className="skeleton skeleton--body" />
      <div className="skeleton skeleton--body skeleton--body-2" />
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="homepage-hero homepage-hero--empty">
      <p className="homepage-hero__date-label">Coming soon</p>
      <h2 className="homepage-hero__title serif">
        Today's debate is being prepared.
      </h2>
      <p className="homepage-hero__summary">
        Baseline publishes one debate topic each morning at 6 AM Eastern.
        Check back shortly — or explore the archive below.
      </p>
    </div>
  );
}

export default function HomePage() {
  const { data: topic, loading, error } = useFetch(() => api.getTodaysTopic(), []);
  const { data: recent } = useFetch(
    () => api.listTopics({ limit: 5, sort: 'date_desc' }),
    []
  );

  return (
    <div className="homepage">
      <div className="container">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="homepage-hero-section" aria-label="Today's debate">
          <div className="homepage-section-label">
            <span className="homepage-section-label__dot" />
            Today's Debate
          </div>

          {loading && <LoadingHero />}

          {!loading && error && (
            <div className="homepage-hero homepage-hero--empty">
              <p className="text-muted">
                {error.includes('No topic') || error.includes('404')
                  ? "Today's topic is being prepared. Check back shortly."
                  : `Could not load today's topic: ${error}`}
              </p>
            </div>
          )}

          {!loading && !error && topic && (
            <TopicCard topic={topic} featured />
          )}

          {!loading && !error && !topic && <EmptyHero />}
        </section>

        {/* ── What is Baseline ─────────────────────────────────────────────── */}
        <section className="homepage-about" aria-label="About Baseline">
          <div className="homepage-about__grid">
            <div className="homepage-about__item">
              <h3 className="homepage-about__item-title">One topic per day</h3>
              <p className="homepage-about__item-body">
                Selected automatically by a divisiveness signal across Reddit, YouTube,
                and Google Trends. We specifically look for topics where public sentiment
                is strongly polarized — not just trending.
              </p>
            </div>
            <div className="homepage-about__item">
              <h3 className="homepage-about__item-title">Real polling data</h3>
              <p className="homepage-about__item-body">
                Aggregated from public polling sources including Pew Research, AP-NORC,
                and RealClearPolitics. Where data exists, we show demographic breakdowns
                by party, age, and gender.
              </p>
            </div>
            <div className="homepage-about__item">
              <h3 className="homepage-about__item-title">Fact-checked arguments</h3>
              <p className="homepage-about__item-body">
                Both sides' strongest arguments are broken into specific, testable claims.
                Each claim receives a verdict aggregated from PolitiFact, FactCheck.org,
                AP, Reuters, and Snopes.
              </p>
            </div>
          </div>
        </section>

        {/* ── Recent archive preview ───────────────────────────────────────── */}
        {recent && recent.items && recent.items.length > 1 && (
          <section className="homepage-recent" aria-label="Recent debates">
            <div className="homepage-section-label">
              <span className="homepage-section-label__dot homepage-section-label__dot--gray" />
              Recent Debates
            </div>
            <div className="homepage-recent__list">
              {recent.items
                .filter(t => !topic || t.slug !== topic.slug)
                .slice(0, 4)
                .map(t => (
                  <TopicCard key={t.slug} topic={t} />
                ))}
            </div>
            <div className="homepage-recent__footer">
              <Link to="/archive" className="homepage-recent__archive-link">
                Browse the full archive →
              </Link>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
