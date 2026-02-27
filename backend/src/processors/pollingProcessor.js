/**
 * Polling processor — uses GPT-4o to match raw scraped polls to the day's topic,
 * extract structured data (top-line numbers, demographics), and generate a
 * coherent polling summary even when raw data is incomplete.
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function processPollingData(topicTitle, rawPolls, pollingHint = '') {
  logger.info('Polling processor started', { topic: topicTitle, rawCount: rawPolls.length, pollingHint });

  const hintSection = pollingHint
    ? `\nPolling search hint (suggested search terms / related question angles): "${pollingHint}"\n`
    : '';

  const prompt = `You are a polling analyst for Baseline, a nonpartisan debate dashboard.

Topic: "${topicTitle}"
${hintSection}
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
  : 'No raw polling data was scraped.'}

Your task:
1. Find the best available polling data for this topic. The poll question does NOT need to be an exact match — a poll about a closely related or overlapping aspect of the debate is perfectly fine. For example, if the topic is "Debate Over Mass Deportation of Undocumented Immigrants", a Gallup poll asking "Do you favor or oppose a policy to deport all undocumented immigrants?" counts, as does a Pew poll about "views on immigration enforcement."
2. Use your knowledge of real, published polls from major pollsters (Gallup, Pew Research, AP-NORC, CNN, NYT/Siena, ABC/Washington Post, Quinnipiac, CBS News/YouGov, NBC News). You almost certainly know of at least 1–2 relevant polls for any mainstream policy topic.
3. Prioritize the most recent polls (within the last 12 months if possible), but older foundational polls are acceptable if recent ones don't exist.
4. Structure the data clearly for display.

Return a JSON object with a "polls" key containing an array in this exact format:
{
  "polls": [
    {
      "pollster": "Pollster name",
      "question": "The actual poll question asked",
      "date_range": "Month Year or Month-Month Year",
      "source_url": "Direct URL to the poll if you know it, null otherwise",
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
      "raw_text": "Brief note on what this poll actually measured and how it relates to the topic"
    }
  ]
}

Rules:
- Include 2–4 polls
- The poll question can be related but not exact — explain the connection in raw_text
- Only include polls where you are genuinely confident the pollster asked something like this question. Do not invent pollsters or fabricate data.
- Set numeric fields to null if you don't know the specific number — never guess percentages
- Demographics: only include breakdowns you're confident exist for this specific poll
- If you truly cannot find any related polling data for this topic, return {"polls": []}`;

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
