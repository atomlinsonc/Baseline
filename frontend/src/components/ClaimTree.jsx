import React, { useState } from 'react';
import { VERDICT_META } from '../utils/format.js';
import './ClaimTree.css';

function VerdictBadge({ verdict }) {
  const meta = VERDICT_META[verdict] || VERDICT_META.contested;
  return (
    <span
      className="verdict-badge"
      style={{ '--verdict-color': meta.color, '--verdict-bg': meta.bg }}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}

function Claim({ claim }) {
  const [expanded, setExpanded] = useState(false);
  const meta = VERDICT_META[claim.verdict] || VERDICT_META.contested;

  return (
    <div className={`claim claim--${claim.verdict}`}>
      <button
        className="claim__header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <VerdictBadge verdict={claim.verdict} />
        <span className="claim__statement">
          {claim.is_values_based ? (
            <span title="This is a philosophical or values-based claim, not empirically testable">
              ◆ {claim.statement}
            </span>
          ) : claim.statement}
        </span>
        <span className="claim__toggle-icon" aria-hidden="true">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div className="claim__detail">
          {claim.is_values_based && (
            <div className="claim__values-note">
              <strong>Note:</strong> This is a philosophical or values-based claim.
              It cannot be resolved through empirical evidence — it reflects a genuine
              difference in values rather than a factual dispute.
            </div>
          )}
          <p className="claim__explanation">{claim.verdict_explanation}</p>
          {claim.sources && claim.sources.length > 0 && (
            <div className="claim__sources">
              <p className="claim__sources-label">Sources consulted:</p>
              <ul className="claim__sources-list">
                {claim.sources.map((src, i) => (
                  <li key={i} className="claim__source-item">
                    {src.url ? (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="claim__source-link"
                      >
                        {src.name} ↗
                      </a>
                    ) : (
                      <span className="claim__source-name">{src.name}</span>
                    )}
                    {src.verdict_from_source && (
                      <span className="claim__source-finding">
                        : {src.verdict_from_source.slice(0, 120)}
                        {src.verdict_from_source.length > 120 ? '…' : ''}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArgumentCard({ argument, side }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`argument argument--${side}`}>
      <button
        className="argument__header"
        onClick={() => setCollapsed(v => !v)}
        aria-expanded={!collapsed}
      >
        <h4 className="argument__headline">{argument.headline}</h4>
        <span className="argument__toggle" aria-hidden="true">{collapsed ? '▼' : '▲'}</span>
      </button>
      <p className="argument__summary">{argument.summary}</p>

      {!collapsed && argument.claims && argument.claims.length > 0 && (
        <div className="argument__claims">
          <p className="argument__claims-label text-xs text-muted">
            Sub-claims — click to see fact-check verdict
          </p>
          {argument.claims.map((claim, i) => (
            <Claim key={i} claim={claim} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClaimTree({ arguments: args }) {
  const { pro = [], con = [] } = args || {};

  if (pro.length === 0 && con.length === 0) {
    return (
      <p className="text-muted text-small">
        Argument data not yet available for this topic.
      </p>
    );
  }

  return (
    <div className="claim-tree">
      <div className="claim-tree__legend">
        <div className="claim-tree__legend-item">
          <span className="claim-tree__legend-dot claim-tree__legend-dot--pro" />
          <span className="text-small">In favor</span>
        </div>
        <div className="claim-tree__legend-item">
          <span className="claim-tree__legend-dot claim-tree__legend-dot--con" />
          <span className="text-small">Against</span>
        </div>
        <div className="claim-tree__legend-sep" />
        <span className="text-xs text-muted">Click any argument to see fact-checked sub-claims</span>
      </div>

      <div className="claim-tree__columns">
        <div className="claim-tree__column claim-tree__column--pro">
          <div className="claim-tree__column-header claim-tree__column-header--pro">
            <span>In Favor</span>
          </div>
          {pro.map((arg, i) => (
            <ArgumentCard key={i} argument={arg} side="pro" />
          ))}
        </div>

        <div className="claim-tree__column claim-tree__column--con">
          <div className="claim-tree__column-header claim-tree__column-header--con">
            <span>Against</span>
          </div>
          {con.map((arg, i) => (
            <ArgumentCard key={i} argument={arg} side="con" />
          ))}
        </div>
      </div>

      <div className="claim-tree__verdict-key">
        <p className="text-xs text-muted" style={{ marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Verdict key</p>
        <div className="claim-tree__verdicts">
          {Object.entries(VERDICT_META).map(([key, meta]) => (
            <div key={key} className="claim-tree__verdict-item">
              <span
                className="verdict-badge verdict-badge--sm"
                style={{ '--verdict-color': meta.color, '--verdict-bg': meta.bg }}
              >
                {meta.label}
              </span>
              <span className="text-xs text-muted">{meta.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
