import React from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../utils/format.js';
import './TopicCard.css';

const CATEGORY_LABELS = {
  'social-issues':      'Social Issues',
  'economic-policy':    'Economic Policy',
  'foreign-policy':     'Foreign Policy',
  'civil-rights':       'Civil Rights',
  'science-technology': 'Science & Technology',
  'religion':           'Religion & Values',
  'healthcare':         'Healthcare',
  'immigration':        'Immigration',
  'education':          'Education',
  'environment':        'Environment',
};

export default function TopicCard({ topic, featured = false }) {
  if (!topic) return null;
  const href = `/topic/${topic.slug}`;
  const catLabel = CATEGORY_LABELS[topic.category] || topic.category;

  if (featured) {
    return (
      <article className="topic-card topic-card--featured">
        <div className="topic-card__meta">
          <span className="topic-card__category">{catLabel}</span>
          <span className="topic-card__sep" aria-hidden="true">·</span>
          <time className="topic-card__date" dateTime={topic.date}>
            {formatDate(topic.date)}
          </time>
          <span className="topic-card__sep" aria-hidden="true">·</span>
          <span className="topic-card__badge">Today's Debate</span>
        </div>
        <h2 className="topic-card__title topic-card__title--featured serif">
          <Link to={href}>{topic.title}</Link>
        </h2>
        <p className="topic-card__summary">{topic.summary}</p>
        <Link to={href} className="topic-card__cta">
          Read the full breakdown →
        </Link>
      </article>
    );
  }

  return (
    <article className="topic-card topic-card--archive">
      <div className="topic-card__meta">
        <span className="topic-card__category">{catLabel}</span>
        <span className="topic-card__sep" aria-hidden="true">·</span>
        <time className="topic-card__date" dateTime={topic.date}>
          {formatDate(topic.date)}
        </time>
      </div>
      <h3 className="topic-card__title">
        <Link to={href}>{topic.title}</Link>
      </h3>
      <p className="topic-card__summary topic-card__summary--clamp">{topic.summary}</p>
    </article>
  );
}
