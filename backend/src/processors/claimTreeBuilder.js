/**
 * Claim tree builder — generates structured pro/con arguments with sub-claims
 * and aggregated fact-check verdicts for each claim.
 *
 * Pipeline:
 *  1. GPT-4o generates the argument structure (headlines + sub-claims)
 *  2. For each claim, we query public fact-checker RSS feeds to find matches
 *  3. GPT-4o aggregates multiple fact-check sources into a single verdict
 *
 * Verdict taxonomy:
 *  - supported          : Multiple credible sources confirm
 *  - mostly_supported   : Broadly true with minor caveats
 *  - contested          : Credible sources disagree or evidence is mixed
 *  - mostly_unsupported : Broadly false with minor elements of truth
 *  - unsupported        : Multiple credible sources refute
 *  - unverifiable       : Fundamentally philosophical/values-based; not empirically testable
 */

const OpenAI = require('openai');
const axios = require('axios');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const rssParser = new RSSParser();

// ── Fact-checker RSS feeds (all public, no auth) ──────────────────────────────
const FACT_CHECKERS = [
  {
    name: 'PolitiFact',
    rss: 'https://www.politifact.com/rss/rulings/',
    url: 'https://www.politifact.com',
  },
  {
    name: 'FactCheck.org',
    rss: 'https://www.factcheck.org/feed/',
    url: 'https://www.factcheck.org',
  },
  {
    name: 'Snopes',
    rss: 'https://www.snopes.com/fact-check/feed/',
    url: 'https://www.snopes.com',
  },
  {
    name: 'AP Fact Check',
    rss: 'https://feeds.apnews.com/rss/apf-factcheck',
    url: 'https://apnews.com',
  },
  {
    name: 'Reuters Fact Check',
    rss: 'https://www.reuters.com/arc/outboundfeeds/v3/category/fact-check/?outputType=xml',
    url: 'https://www.reuters.com',
  },
];

// Cache fact-checker feeds for the current run
let _feedCache = null;

async function loadFactCheckerFeeds() {
  if (_feedCache) return _feedCache;

  const feeds = await Promise.allSettled(
    FACT_CHECKERS.map(async fc => {
      try {
        const feed = await rssParser.parseURL(fc.rss);
        return { ...fc, items: feed.items.slice(0, 50) };
      } catch {
        return { ...fc, items: [] };
      }
    })
  );

  _feedCache = feeds
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const totalItems = _feedCache.reduce((s, f) => s + f.items.length, 0);
  logger.info(`Loaded fact-checker feeds: ${totalItems} items`);
  return _feedCache;
}

function findRelevantFactChecks(claim, feeds) {
  const claimWords = claim.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const results = [];

  for (const fc of feeds) {
    for (const item of fc.items) {
      const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
      const matches = claimWords.filter(w => text.includes(w)).length;
      const relevance = matches / Math.max(claimWords.length, 1);
      if (relevance > 0.25) {
        results.push({
          source: fc.name,
          url: item.link,
          title: item.title,
          snippet: (item.contentSnippet || '').slice(0, 200),
          relevance,
          date: item.pubDate,
        });
      }
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
}

// ── Step 1: Generate argument structure ───────────────────────────────────────
async function generateArgumentStructure(topicTitle, summary, trendingReason) {
  const prompt = `You are a neutral policy analyst for Baseline, a nonpartisan debate dashboard.

Topic: "${topicTitle}"
Context: ${summary}
Why it's trending: ${trendingReason}

Generate a structured argument tree with exactly:
- 3 top-level arguments for each side (pro = supporting/in-favor, con = opposing/against)
- Each top-level argument has 2–3 specific, fact-checkable sub-claims

CRITICAL RULES:
- Every sub-claim must be a specific, empirically testable statement (a fact, statistic, causal claim, or historical assertion)
- Mark any sub-claim that is fundamentally a values/philosophical judgment (not empirically testable) as values_based: true
- Arguments should represent the strongest, most mainstream positions on each side — not fringe views
- No strawmen. Steel-man both sides.
- Use neutral, precise language. No editorializing.

Return JSON exactly in this format:
{
  "pro": [
    {
      "headline": "Short argument headline (max 10 words)",
      "summary": "1–2 sentence elaboration of this argument",
      "claims": [
        {
          "statement": "Specific, testable claim statement",
          "values_based": false
        }
      ]
    }
  ],
  "con": [
    {
      "headline": "Short argument headline (max 10 words)",
      "summary": "1–2 sentence elaboration of this argument",
      "claims": [
        {
          "statement": "Specific, testable claim statement",
          "values_based": false
        }
      ]
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ── Step 2: Fact-check each claim ─────────────────────────────────────────────
async function factCheckClaim(claim, feeds) {
  const relevantChecks = findRelevantFactChecks(claim.statement, feeds);

  const prompt = `You are a fact-checker for Baseline, a nonpartisan debate dashboard. Evaluate this claim:

CLAIM: "${claim.statement}"
VALUES-BASED: ${claim.values_based ? 'Yes — this is a philosophical/moral claim, not empirically testable' : 'No — this should be empirically evaluated'}

${relevantChecks.length > 0 ? `RELEVANT FACT-CHECKS FOUND:\n${relevantChecks.map(fc =>
  `- ${fc.source}: "${fc.title}" — ${fc.snippet}`
).join('\n')}` : 'No directly relevant fact-checks found in current feeds. Use your knowledge of established research and evidence.'}

Apply the following verdict scale:
- "supported": Strong evidence confirms the claim; no credible contradicting sources
- "mostly_supported": Broadly true but with important caveats or missing context
- "contested": Credible evidence exists on both sides; genuine expert disagreement
- "mostly_unsupported": Broadly false but contains elements of truth
- "unsupported": Evidence clearly contradicts the claim
- "unverifiable": The claim is fundamentally philosophical, values-based, or cannot be tested empirically

Return JSON:
{
  "verdict": "one of the six options above",
  "explanation": "2–3 sentences explaining the verdict. Cite specific evidence, studies, or sources where possible. If unverifiable, explain why it's values-based rather than empirical.",
  "sources": [
    {"name": "source name", "url": "url if available", "verdict_from_source": "what this source found"}
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(response.choices[0].message.content);

  // Merge any real fact-checker URLs we found
  const realSources = relevantChecks.slice(0, 3).map(rc => ({
    name: rc.source,
    url: rc.url,
    verdict_from_source: rc.snippet,
  }));

  return {
    ...result,
    sources: [...realSources, ...(result.sources || []).filter(s => s.url && !realSources.some(r => r.url === s.url))].slice(0, 5),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────
async function buildClaimTree(topicTitle, summary, trendingReason) {
  logger.info('Claim tree builder started', { topic: topicTitle });

  // Load fact-checker feeds once
  const feeds = await loadFactCheckerFeeds();

  // Generate argument structure
  const structure = await generateArgumentStructure(topicTitle, summary, trendingReason);
  logger.info('Argument structure generated');

  // Fact-check all claims (process in parallel but respect rate limits)
  async function processArgs(args, side) {
    const processed = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const checkedClaims = [];
      for (let j = 0; j < arg.claims.length; j++) {
        const claim = arg.claims[j];
        logger.debug(`Fact-checking ${side} arg ${i+1} claim ${j+1}: ${claim.statement.slice(0, 60)}…`);
        const result = await factCheckClaim(claim, feeds);
        checkedClaims.push({
          statement: claim.statement,
          values_based: claim.values_based || false,
          verdict: claim.values_based ? 'unverifiable' : result.verdict,
          verdict_explanation: result.explanation,
          sources: result.sources || [],
        });
        // Brief pause to avoid hitting OpenAI rate limits
        await new Promise(r => setTimeout(r, 500));
      }
      processed.push({ ...arg, claims: checkedClaims });
    }
    return processed;
  }

  const [proArgs, conArgs] = await Promise.all([
    processArgs(structure.pro || [], 'pro'),
    processArgs(structure.con || [], 'con'),
  ]);

  logger.info('Claim tree complete', {
    pro_args: proArgs.length,
    con_args: conArgs.length,
  });

  return { pro: proArgs, con: conArgs };
}

module.exports = { buildClaimTree };
