/**
 * Polling processor — uses GPT-4o to match raw scraped polls to the day's topic,
 * extract structured data (top-line numbers, demographics), and generate a
 * coherent polling summary even when raw data is incomplete.
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function processPollingData(topicTitle, rawPolls) {
  logger.info('Polling processor started', { topic: topicTitle, rawCount: rawPolls.length });

  const prompt = `You are a polling analyst for Baseline, a nonpartisan debate dashboard.

Topic: "${topicTitle}"

Raw polling data gathered from public sources:
${rawPolls.length > 0
  ? rawPolls.map((p, i) => `
POLL ${i + 1}:
  Pollster: ${p.pollster}
  Question: ${p.question}
  Date: ${p.date_range}
  Support: ${p.topline_support}% | Oppose: ${p.topline_oppose}% | Neutral: ${p.topline_neutral}%
  Source: ${p.source_url}
  Raw text: ${(p.raw_text || '').slice(0, 300)}`).join('\n')
  : 'No raw polling data was scraped. Use your knowledge of recent public polling on this topic.'}

Your task:
1. Select the most relevant, recent, high-quality polls that directly measure public opinion on "${topicTitle}"
2. If raw data is missing or incomplete, supplement with your knowledge of actual published polls (cite real pollsters and approximate dates)
3. Structure the data clearly for display

Return a JSON array of polls in this exact format:
[
  {
    "pollster": "Pollster name",
    "question": "Exact or paraphrased poll question",
    "date_range": "Month Year or Month-Month Year",
    "source_url": "URL if available, null otherwise",
    "topline_support": 45.2,
    "topline_oppose": 48.1,
    "topline_neutral": 6.7,
    "demographics": {
      "party": {
        "Democrat": {"support": 72, "oppose": 22},
        "Republican": {"support": 18, "oppose": 76},
        "Independent": {"support": 44, "oppose": 46}
      },
      "age": {
        "18-29": {"support": 55, "oppose": 38},
        "30-49": {"support": 48, "oppose": 44},
        "50-64": {"support": 40, "oppose": 52},
        "65+": {"support": 36, "oppose": 56}
      },
      "gender": {
        "Men": {"support": 40, "oppose": 52},
        "Women": {"support": 50, "oppose": 42}
      }
    },
    "raw_text": "Brief note on methodology or question wording"
  }
]

Rules:
- Include 2–5 polls maximum
- Only include polls where you're confident in the data
- Set numeric fields to null if genuinely unknown — do not fabricate precise numbers
- Demographics: only include breakdowns where you have reasonable data
- If no good polling data exists for this topic, return an empty array []`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  // The model may return an object with a polls key or a direct array
  const content = JSON.parse(response.choices[0].message.content);
  const polls = Array.isArray(content) ? content : (content.polls || []);

  logger.info(`Polling processor: returning ${polls.length} polls`);
  return polls;
}

module.exports = { processPollingData };
