import React, { useState } from 'react';
import { formatPercent } from '../utils/format.js';
import './PollingChart.css';

function Bar({ value, max = 100, color, label, pct }) {
  const width = value != null ? (value / max) * 100 : 0;
  return (
    <div className="poll-bar">
      <div className="poll-bar__label">{label}</div>
      <div className="poll-bar__track">
        <div
          className="poll-bar__fill"
          style={{ width: `${width}%`, backgroundColor: color }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={`${label}: ${formatPercent(value)}`}
        />
      </div>
      <div className="poll-bar__value">{formatPercent(pct ?? value)}</div>
    </div>
  );
}

function ToplineChart({ poll }) {
  const { topline_support: sup, topline_oppose: opp, topline_neutral: neu } = poll;
  if (sup == null && opp == null) return null;

  return (
    <div className="poll-topline">
      {sup != null && <Bar value={sup} color="#1e5c8a" label="Support" />}
      {opp != null && <Bar value={opp} color="#8a2020" label="Oppose" />}
      {neu != null && <Bar value={neu} color="#9e9b94" label="Neutral/Unsure" />}
    </div>
  );
}

function DemographicBreakdown({ demographics }) {
  if (!demographics) return null;
  const sections = Object.entries(demographics);
  if (sections.length === 0) return null;

  return (
    <div className="poll-demo">
      {sections.map(([group, breakdown]) => (
        <div key={group} className="poll-demo__group">
          <h5 className="poll-demo__group-label">{formatGroupLabel(group)}</h5>
          <div className="poll-demo__rows">
            {Object.entries(breakdown).map(([subgroup, data]) => (
              <div key={subgroup} className="poll-demo__row">
                <div className="poll-demo__subgroup">{subgroup}</div>
                <div className="poll-demo__bars">
                  {data.support != null && (
                    <Bar
                      value={data.support}
                      color="#1e5c8a"
                      label="Support"
                      pct={data.support}
                    />
                  )}
                  {data.oppose != null && (
                    <Bar
                      value={data.oppose}
                      color="#8a2020"
                      label="Oppose"
                      pct={data.oppose}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatGroupLabel(key) {
  const labels = {
    party: 'By Party',
    age: 'By Age',
    gender: 'By Gender',
    race: 'By Race/Ethnicity',
    education: 'By Education',
    income: 'By Income',
  };
  return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export default function PollingChart({ polls }) {
  const [activePoll, setActivePoll] = useState(0);
  const [showDemo, setShowDemo] = useState(false);

  if (!polls || polls.length === 0) {
    return (
      <div className="polling-chart polling-chart--empty">
        <p className="text-muted text-small">
          No polling data currently available for this topic.
        </p>
      </div>
    );
  }

  const poll = polls[activePoll];

  return (
    <div className="polling-chart">
      {/* Poll selector tabs */}
      {polls.length > 1 && (
        <div className="polling-chart__tabs" role="tablist" aria-label="Select poll">
          {polls.map((p, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activePoll}
              className={`polling-chart__tab${i === activePoll ? ' is-active' : ''}`}
              onClick={() => { setActivePoll(i); setShowDemo(false); }}
            >
              {p.pollster}
            </button>
          ))}
        </div>
      )}

      {/* Active poll */}
      <div className="polling-chart__poll" role="tabpanel">
        <div className="polling-chart__question">
          <p className="text-small text-muted">
            <strong>{poll.pollster}</strong>
            {poll.date_range && <> · {poll.date_range}</>}
          </p>
          <p className="polling-chart__q-text">"{poll.question}"</p>
        </div>

        <ToplineChart poll={poll} />

        {poll.demographics && (
          <div className="polling-chart__demo-toggle">
            <button
              className="polling-chart__demo-btn"
              onClick={() => setShowDemo(v => !v)}
              aria-expanded={showDemo}
            >
              {showDemo ? 'Hide' : 'Show'} demographic breakdown
            </button>
            {showDemo && <DemographicBreakdown demographics={poll.demographics} />}
          </div>
        )}

        {poll.source_url && (
          <a
            href={poll.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="polling-chart__source text-xs text-muted"
          >
            Source: {poll.pollster} ↗
          </a>
        )}
      </div>
    </div>
  );
}
