/**
 * Development seed — inserts a sample topic so the frontend works
 * without running the full AI pipeline.
 *
 * Usage: npm run seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const { initDb } = require('./schema');
const { insertTopic, insertPoll, insertArgument, insertClaim, topicExistsForDate } = require('./queries');

const TODAY = new Date().toISOString().slice(0, 10);

function seed() {
  initDb();

  if (topicExistsForDate(TODAY)) {
    console.log(`Topic already exists for ${TODAY}. Delete the DB to re-seed.`);
    console.log(`DB path: ${process.env.DB_PATH || './data/baseline.db'}`);
    process.exit(0);
  }

  console.log(`Seeding sample topic for ${TODAY}...`);

  const topicId = insertTopic({
    slug: `student-loan-forgiveness-${TODAY}`,
    title: 'Student Loan Forgiveness',
    date: TODAY,
    category: 'economic-policy',
    summary: 'The Biden administration\'s broad student debt cancellation program faces continued legal challenges and political debate, with the Supreme Court having struck down the original $400B plan. Targeted relief programs continue while Congress debates permanent legislative solutions.',
    trending_reason: 'Debate is surging across Reddit\'s r/politics and r/PoliticalDiscussion following new SAVE plan court rulings, with the topic trending on Google and drawing millions of YouTube views on news coverage this week.',
    divisiveness_score: 0.78,
    status: 'published',
  });

  // Polls
  insertPoll({
    topic_id: topicId,
    pollster: 'AP-NORC',
    question: 'Do you favor or oppose the federal government forgiving student loan debt?',
    date_range: 'Sep 2023',
    source_url: 'https://apnorc.org',
    topline_support: 42,
    topline_oppose: 58,
    topline_neutral: null,
    demographics: JSON.stringify({
      party: {
        Democrat: { support: 70, oppose: 30 },
        Republican: { support: 14, oppose: 86 },
        Independent: { support: 40, oppose: 60 },
      },
      age: {
        '18-29': { support: 60, oppose: 40 },
        '30-44': { support: 48, oppose: 52 },
        '45-64': { support: 36, oppose: 64 },
        '65+': { support: 28, oppose: 72 },
      },
      education: {
        'College degree': { support: 48, oppose: 52 },
        'No college degree': { support: 37, oppose: 63 },
      },
    }),
    raw_text: 'Question: "Do you favor or oppose the federal government forgiving student loan debt for people who took out loans to pay for college or other school after high school?"',
  });

  insertPoll({
    topic_id: topicId,
    pollster: 'Pew Research Center',
    question: 'Support for canceling student loan debt for those who didn\'t complete their degree',
    date_range: 'Feb 2023',
    source_url: 'https://pewresearch.org',
    topline_support: 56,
    topline_oppose: 44,
    topline_neutral: null,
    demographics: JSON.stringify({
      party: {
        Democrat: { support: 79, oppose: 21 },
        Republican: { support: 31, oppose: 69 },
      },
    }),
    raw_text: 'Specific question about forgiving debt for students who attended but did not complete their degree.',
  });

  // Pro arguments
  const pro1 = insertArgument({
    topic_id: topicId, side: 'pro', position: 0,
    headline: 'Student debt is a macroeconomic drag',
    summary: 'Over $1.7 trillion in outstanding student debt suppresses consumer spending, homeownership, and retirement savings, constraining economic growth.',
  });
  insertClaim({ argument_id: pro1, topic_id: topicId, position: 0,
    statement: 'Total U.S. student loan debt exceeds $1.7 trillion as of 2024.',
    verdict: 'supported',
    verdict_explanation: 'Federal Reserve and Department of Education data consistently confirm this figure. The exact total fluctuates with disbursements and payments but has exceeded $1.7T since 2021.',
    is_values_based: 0,
    sources: JSON.stringify([
      { name: 'Federal Reserve', url: 'https://www.federalreserve.gov', verdict_from_source: 'Confirmed in Consumer Credit report' },
      { name: 'Department of Education', url: 'https://studentaid.gov', verdict_from_source: 'Portfolio summary data confirms' },
    ]),
  });
  insertClaim({ argument_id: pro1, topic_id: topicId, position: 1,
    statement: 'Student debt holders are significantly less likely to own homes than similar cohorts without debt.',
    verdict: 'mostly_supported',
    verdict_explanation: 'Multiple studies find a correlation between student debt and delayed homeownership. The Federal Reserve Bank of New York (2019) found student debt reduced homeownership rates. Causality debate exists as higher-debt individuals also have higher income potential.',
    is_values_based: 0,
    sources: JSON.stringify([
      { name: 'Federal Reserve Bank of NY', url: 'https://www.newyorkfed.org', verdict_from_source: 'Found significant negative effect on homeownership' },
    ]),
  });

  const pro2 = insertArgument({
    topic_id: topicId, side: 'pro', position: 1,
    headline: 'Predatory for-profit colleges caused systemic harm',
    summary: 'Millions of borrowers attended schools that fraudulently misrepresented job placement rates and outcomes, leaving students with debt and worthless credentials.',
  });
  insertClaim({ argument_id: pro2, topic_id: topicId, position: 0,
    statement: 'The Department of Education found that many for-profit colleges engaged in deceptive marketing practices regarding employment outcomes.',
    verdict: 'supported',
    verdict_explanation: 'DOE investigations and state AG lawsuits against ITT Tech, Corinthian Colleges, DeVry, and others documented systematic misrepresentation of job placement rates. Borrower Defense to Repayment program was created specifically to address this harm.',
    is_values_based: 0,
    sources: JSON.stringify([
      { name: 'Department of Education', url: 'https://studentaid.gov/borrower-defense', verdict_from_source: 'Approved $11.7B in borrower defense claims' },
    ]),
  });

  const pro3 = insertArgument({
    topic_id: topicId, side: 'pro', position: 2,
    headline: 'Government should honor implicit social contract',
    summary: 'Students were encouraged by schools, counselors, and government policy to take on debt as an investment — cancellation corrects for a social promise that didn\'t pay off.',
  });
  insertClaim({ argument_id: pro3, topic_id: topicId, position: 0,
    statement: 'Canceling student debt is fundamentally fair given that high-income earners received more benefit from past tax cuts.',
    verdict: 'unverifiable',
    verdict_explanation: 'This is a values-based distributional fairness claim. Whether student debt cancellation is "fair" relative to other policy decisions involves normative judgments about equity and desert that cannot be empirically resolved. Reasonable people with different values reach different conclusions.',
    is_values_based: 1,
    sources: JSON.stringify([]),
  });

  // Con arguments
  const con1 = insertArgument({
    topic_id: topicId, side: 'con', position: 0,
    headline: 'Cancellation is regressive — benefits higher earners',
    summary: 'College graduates earn more than non-graduates over a lifetime. Broad cancellation transfers wealth upward, from those who didn\'t attend college to those who did.',
  });
  insertClaim({ argument_id: con1, topic_id: topicId, position: 0,
    statement: 'College graduates earn significantly more over their lifetimes than those without degrees, making student debt cancellation a transfer to higher earners.',
    verdict: 'mostly_supported',
    verdict_explanation: 'Data from the Bureau of Labor Statistics shows bachelor\'s degree holders earn a median 65% more than high school graduates. However, the effect is less clear for graduate debt holders and those from for-profit schools who didn\'t complete degrees.',
    is_values_based: 0,
    sources: JSON.stringify([
      { name: 'Bureau of Labor Statistics', url: 'https://www.bls.gov', verdict_from_source: 'Education pays report confirms wage premium' },
      { name: 'Brookings Institution', url: 'https://brookings.edu', verdict_from_source: 'Analysis confirmed regressive distribution of broad cancellation' },
    ]),
  });
  insertClaim({ argument_id: con1, topic_id: topicId, position: 1,
    statement: 'The majority of outstanding student loan debt is held by graduate students and professionals (lawyers, doctors, MBAs).',
    verdict: 'mostly_supported',
    verdict_explanation: 'Graduate borrowers hold a disproportionate share of debt. The Education Data Initiative reports graduate students make up about 40% of borrowers but hold approximately 53% of total debt. However, "majority" is an overstatement — undergrad debt remains substantial.',
    is_values_based: 0,
    sources: JSON.stringify([
      { name: 'Education Data Initiative', url: 'https://educationdata.org', verdict_from_source: 'Graduate borrower data confirmed' },
    ]),
  });

  const con2 = insertArgument({
    topic_id: topicId, side: 'con', position: 1,
    headline: 'Adds to national debt without fixing the root cause',
    summary: 'Cancellation addresses symptoms but not the underlying driver — rapidly rising tuition costs — and may worsen the problem by signaling future cancellations.',
  });
  insertClaim({ argument_id: con2, topic_id: topicId, position: 0,
    statement: 'The Biden administration\'s broad student debt cancellation plan would have cost approximately $400 billion.',
    verdict: 'supported',
    verdict_explanation: 'The Congressional Budget Office estimated the cost of the plan struck down in Biden v. Nebraska at approximately $400 billion. The administration\'s own estimate was similar.',
    is_values_based: 0,
    sources: JSON.stringify([
      { name: 'Congressional Budget Office', url: 'https://cbo.gov', verdict_from_source: 'CBO cost estimate confirmed ~$400B' },
    ]),
  });
  insertClaim({ argument_id: con2, topic_id: topicId, position: 1,
    statement: 'Loan forgiveness expectations cause universities to raise tuition because students are less price-sensitive when they expect future forgiveness.',
    verdict: 'contested',
    verdict_explanation: 'This "moral hazard" argument is theoretically sound but empirically uncertain. Some economists support the mechanism; others argue university pricing is driven by state funding cuts and amenities competition rather than student price sensitivity. No strong empirical study has isolated the cancellation expectation effect.',
    is_values_based: 0,
    sources: JSON.stringify([
      { name: 'FactCheck.org', url: 'https://factcheck.org', verdict_from_source: 'Rated claims about tuition effects as "complicated"' },
    ]),
  });

  const con3 = insertArgument({
    topic_id: topicId, side: 'con', position: 2,
    headline: 'Unfair to those who sacrificed to repay or avoided college debt',
    summary: 'People who worked through school, chose community college, or scrimped to repay loans receive nothing, rewarding those who borrowed more over those who were financially responsible.',
  });
  insertClaim({ argument_id: con3, topic_id: topicId, position: 0,
    statement: 'Forgiving student loans is fundamentally unfair to borrowers who already paid off their loans.',
    verdict: 'unverifiable',
    verdict_explanation: 'Fairness claims about who "deserves" relief are fundamentally normative. Whether retroactive relief is unfair to past repayers involves values about desert, equity, and social policy that cannot be resolved empirically. This is a genuine values disagreement rather than a factual dispute.',
    is_values_based: 1,
    sources: JSON.stringify([]),
  });

  console.log(`✓ Sample topic seeded for ${TODAY} (topicId: ${topicId})`);
  console.log(`  Slug: student-loan-forgiveness-${TODAY}`);
  console.log('');
  console.log('Start the backend: npm run dev');
  console.log('Start the frontend: cd ../frontend && npm run dev');
}

seed();
