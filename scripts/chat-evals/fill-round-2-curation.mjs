#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const BATCH_PATHS = {
  oneTwo: '/tmp/publisheriq-chat-evals/round-2-sections-1-2/curation-template.json',
  threeFour: '/tmp/publisheriq-chat-evals/round-2-sections-3-4/curation-template.json',
  five: '/tmp/publisheriq-chat-evals/round-2-section-5/curation-template.json',
  six: '/tmp/publisheriq-chat-evals/round-2-section-6/curation-template.json',
  sixResults: '/tmp/publisheriq-chat-evals/round-2-section-6/results.json',
};

const ONE_TWO_UPDATES = {
  'free metroidvania games': {
    score: 7.4,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Sparse but finally review-backed; the first row is useful, but the tiny low-signal tail keeps it from feeling curated.',
    curatorNotes:
      'For a studio lead, this is now a plausible starting point because review counts are visible and the query stays on-constraint. The downside is that half the set is weak or unrated, so it still behaves more like a sparse dump than a confidently filtered discovery board.',
  },
  'tell me about Hades II': {
    score: 8.6,
    verdict: 'Strong',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Direct, decision-ready lookup with release state, price, review volume, and platform status.',
    curatorNotes:
      'This gives the product lead the core commercial and platform context immediately, with no obvious noise. It is still a compact overview rather than a deeper strategic brief, but it nails the expected lookup job.',
  },
  'Show me all the DLC for Elden Ring': {
    score: 6.4,
    verdict: 'Mixed',
    usefulnessVerdict: 'Partially useful',
    usefulnessSummary:
      'More complete DLC enumeration, but missing names still limits it to a metadata audit instead of a player-friendly list.',
    curatorNotes:
      'For a studio lead validating catalog structure, the extra storefront and PICS rows are useful evidence. For normal product research, though, a DLC table without names or release context is still only partially usable.',
  },
  'Games currently on sale': {
    score: 5.0,
    verdict: 'Weak',
    usefulnessVerdict: 'Not useful',
    usefulnessSummary: 'Still a massive on-sale leaderboard rather than a decision-ready shortlist.',
    curatorNotes:
      'This answers the literal sale query, but not the strategic intent a publishing lead usually has when asking it. Without curation, segmentation, or any notion of why these discounted titles matter, it remains a low-signal bargain dump.',
  },
  'Highly rated games under $10 released in the past year': {
    score: 8.0,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Direct and now genuinely useful: the answer surfaces a real affordable shortlist with review volume visible.',
    curatorNotes:
      'This is a real improvement because it returns an actionable budget-discovery board instead of a dead end. The main thing still missing is light curation on why these titles matter, but the list itself is credible and on-constraint.',
  },
  'Games under $5 with overwhelmingly positive reviews': {
    score: 5.3,
    verdict: 'Weak',
    usefulnessVerdict: 'Not useful',
    usefulnessSummary:
      'Transparent empty-set response, but it leaves the user with no fallback shortlist or supporting evidence.',
    curatorNotes:
      'If the set is truly empty, the system is at least honest. For a publishing lead, though, a discovery prompt that terminates immediately without a fallback threshold or adjacent alternatives is still not very useful.',
  },
  'Premium games over $40 with great reviews': {
    score: 7.7,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Credible premium hits are back, though the tail stretches "great reviews" a little too loosely.',
    curatorNotes:
      'This is useful as a quick benchmark board for high-price games, and the head of the list is strong. The tail includes lower-80s review scores that weaken the semantic quality bar behind "great."',
  },
  'Which indie developers have multiple hit games?': {
    score: 6.7,
    verdict: 'Mixed',
    usefulnessVerdict: 'Partially useful',
    usefulnessSummary:
      'Strong top rows, but the lower half still admits studios that do not really clear a professional "multiple hit games" bar.',
    curatorNotes:
      'A strategy lead could absolutely use the top of this answer. The problem is that once the table drifts into average-review and low-quality portfolios, the trust bar on "hit" weakens materially.',
  },
  'Compare FromSoftware and Team Cherry by reviews': {
    score: 7.8,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Clean portfolio comparison with scale, review, and owner context that an investor can act on.',
    curatorNotes:
      'This is a solid investor-facing answer because it frames both breadth and intensity of success without wasting space. The only thing missing is a little more interpretation of what the disparity in game counts means strategically.',
  },
  'What publishers are releasing the most games this year?': {
    score: 6.3,
    verdict: 'Mixed',
    usefulnessVerdict: 'Partially useful',
    usefulnessSummary:
      'More interpretable than raw volume alone, but still too noisy and scale-blind for strategy work.',
    curatorNotes:
      'The added total-review and average-score context helps. Even so, the answer still over-rewards publishers with lots of small releases and does not give the publishing lead enough filtering to distinguish signal from output spam.',
  },
  'Publishers with the most games released in the past 6 months': {
    score: 7.1,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Meaningful-release framing makes this materially more useful, even if the table still mixes volume with uneven quality.',
    curatorNotes:
      'This is closer to what a strategy lead wants because it separates total releases from meaningful ones and adds review context. A few rows still look noisy, but the screen is much more actionable than a raw shipment count.',
  },
  'Publishers with 5+ games averaging 85%+ reviews in the past 3 years': {
    score: 6.5,
    verdict: 'Mixed',
    usefulnessVerdict: 'Partially useful',
    usefulnessSummary:
      'Honest limitation handling protects trust, but it still does not answer the requested three-year screen.',
    curatorNotes:
      'An investor would rather hear a limitation than receive a fabricated answer, so trust is better than the earlier false-zero behavior. The weakness is straightforward: the prompt asks for a three-year leaderboard and the system still cannot deliver one.',
  },
  'Developers with 3+ games, all above 90% reviews, with a release in the past year': {
    score: 5.9,
    verdict: 'Mixed',
    usefulnessVerdict: 'Partially useful',
    usefulnessSummary:
      'The exact screen is surfaced, but thin-review and zero-meaningful-release rows drag the result back under the trust bar.',
    curatorNotes:
      'This answer is formally on-constraint, but not commercially convincing. A publishing lead will notice that several rows are driven by tiny samples or zero meaningful releases, which undercuts the point of the screen.',
  },
  'What tags exist for colony sim games?': {
    score: 7.3,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary: 'Simple, correct tag answer with useful adjacent terms and no broken links.',
    curatorNotes:
      'This now behaves like a clean tag-discovery answer: it gives the canonical tag and adjacent search directions without obvious product bugs. It is lightweight, but it does the job a product lead would expect.',
  },
  'Show me all games by FromSoftware': {
    score: 7.6,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Useful catalog output, but recency-sorted archive and mobile rows still crowd out the titles people actually care about.',
    curatorNotes:
      'A studio lead can still use this to navigate the catalog, and the major FromSoftware releases are present. The sort order keeps it from feeling polished because the most relevant flagship titles are buried under low-signal archive entries.',
  },
  'top games from FromSoftware': {
    score: 8.1,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary: 'Strong flagship ranking with reviews and owners, with only a small link-trust blemish.',
    curatorNotes:
      'This is close to production quality because it ranks recognizable flagship titles with the right commercial context. The only real blemish is the inconsistent developer link in the closing sentence.',
  },
  'Which publishers released the most games this year?': {
    score: 6.3,
    verdict: 'Mixed',
    usefulnessVerdict: 'Partially useful',
    usefulnessSummary:
      'Same improvement as the sibling phrasing, but it is still too close to a noisy raw-volume leaderboard.',
    curatorNotes:
      'The answer is not useless, because it at least adds review context to the raw count. The underlying screen is still too permissive for strategy work and still lets low-signal publishers crowd the top of the board.',
  },
  'games by FromSoftware': {
    score: 7.6,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Usable developer catalog, though the sort order still prioritizes low-signal recent entries over flagship relevance.',
    curatorNotes:
      'This works as a navigational company lookup, but the ordering still makes it feel more like an internal export than a polished user-facing portfolio view. A product lead can use it, but will mentally re-rank the list.',
  },
  'What publishers are similar to Devolver Digital?': {
    score: 5.3,
    verdict: 'Weak',
    usefulnessVerdict: 'Not useful',
    usefulnessSummary:
      'PLAYISM and Team17 help, but Square Enix and Xbox still make the peer set feel too scale-blind.',
    curatorNotes:
      'This no longer looks like a total failure, and PLAYISM is a useful directional peer. The strategist still cannot trust the peer set as an actual competitive frame because Square Enix and Xbox Game Studios overwhelm the indie and AA posture that makes Devolver distinctive.',
  },
  'Show me developers similar to Supergiant Games': {
    score: 7.5,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Still the best company-similarity answer: credible peers, flagship context, and enough rationale to act on.',
    curatorNotes:
      'This remains the most usable similarity answer in the suite. Not every row is perfect, but the answer is directionally right, gives concrete flagship context, and is good enough for a first-pass peer scan.',
  },
  'Publishers with releases in every year since 2020': {
    score: 2.6,
    verdict: 'Failure',
    usefulnessVerdict: 'Not useful',
    usefulnessSummary:
      'Iteration-limit failure after repeated empty analytics queries; no continuity screen was actually returned.',
    curatorNotes:
      'This is a hard failure for the investor persona because the system spends seven tool calls and still returns only an internal failure message. There is no screening value here at all.',
  },
  'how many games has Krafton published?': {
    score: 7.1,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Count plus portfolio context is useful, but the representative-title pairing includes at least one questionable example.',
    curatorNotes:
      'The investor still gets the main thing they asked for: a total count with some review context. Trust drops because the supporting example set does not look entirely reliable, so I would verify before acting on the portfolio interpretation.',
  },
  'How many games has Valve published?': {
    score: 8.1,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Count plus review-weighted flagship context gives a strong quick read on Valve.',
    curatorNotes:
      'This is a solid investor lookup: the core count is explicit and the answer adds immediate proof of scale through Counter-Strike and Dota. It could still mention portfolio composition beyond the two giants, but it clears the usefulness bar easily.',
  },
};

const SIX_SUCCESS_UPDATES = {
  'Show me the recent Steam changes for Hades II': {
    score: 5.9,
    verdict: 'Mixed',
    usefulnessVerdict: 'Partially useful',
    usefulnessSummary:
      'Price and discount changes surface clearly, but the announcement rows collapse into repeated placeholder text.',
    curatorNotes:
      'A market-intel analyst does learn that Hades II had a price cut, discount start, and an announcement cluster. The repeated placeholder rows hide the substance of the change log, though, and leave too little actionable detail to trust the answer as a real recent-changes brief.',
  },
  'What changed on Hades II before and after its last big update?': {
    score: 6.2,
    verdict: 'Mixed',
    usefulnessVerdict: 'Partially useful',
    usefulnessSummary:
      'Useful price and discount evidence, but it never really isolates a specific "last big update" or page-diff narrative.',
    curatorNotes:
      'This partially answers the question by tying recent pricing, discount, and performance context together. For an analyst looking for page-change causality around a specific update beat, though, it still reads more like a recent-status summary than a true before-and-after analysis.',
  },
  'What changed on the Steam page for `No Rest for the Wicked` before and after its last major update?': {
    score: 7.4,
    verdict: 'Good',
    usefulnessVerdict: 'Useful',
    usefulnessSummary:
      'Real before-and-after metrics and change evidence make this the only genuinely decision-useful section 6 answer in the batch.',
    curatorNotes:
      'This gives the analyst concrete deltas on build ID, content-update timing, price, CCU response, and review movement, which is the right shape for change-intelligence work. It is not perfect, but it is detailed enough to support an actual interpretation of the update response.',
  },
};

async function main() {
  await curateOneTwo();
  await curateThreeFour();
  await curateSix();
  console.log('Filled round-2 curation templates for sections 1-2, 3-4, and 6.');
}

async function curateOneTwo() {
  const entries = JSON.parse(await fs.readFile(BATCH_PATHS.oneTwo, 'utf8'));
  const updated = entries.map((entry) => {
    const override = ONE_TWO_UPDATES[entry.prompt];
    if (!override) {
      throw new Error(`Missing sections 1-2 curation override for "${entry.prompt}"`);
    }
    return applyOverride(entry, override);
  });
  await writeJson(BATCH_PATHS.oneTwo, updated);
}

async function curateThreeFour() {
  const entries = JSON.parse(await fs.readFile(BATCH_PATHS.threeFour, 'utf8'));
  const updated = entries.map((entry) => {
    const scoreBreakdown = hasBreakdown(entry.scoreBreakdown)
      ? entry.scoreBreakdown
      : deriveBreakdown(entry.score, entry);
    return {
      ...entry,
      usefulnessVerdict: entry.usefulnessVerdict || inferUsefulnessVerdict(entry.verdict),
      scoreBreakdown,
    };
  });
  await writeJson(BATCH_PATHS.threeFour, updated);
}

async function curateSix() {
  const entries = JSON.parse(await fs.readFile(BATCH_PATHS.six, 'utf8'));
  const results = JSON.parse(await fs.readFile(BATCH_PATHS.sixResults, 'utf8'));
  const statusByPrompt = new Map(results.map((row) => [row.prompt_text, row.status]));

  const updated = entries.map((entry) => {
    const override = SIX_SUCCESS_UPDATES[entry.prompt];
    if (override) {
      return applyOverride(entry, override);
    }

    if (statusByPrompt.get(entry.prompt) === 'error') {
      return applyOverride(entry, {
        score: 1.2,
        verdict: 'Failure',
        usefulnessVerdict: 'Not useful',
        usefulnessSummary: 'Backend statement timeout; no answer or evidence was returned.',
        curatorNotes: buildTimeoutNotes(entry),
        scoreBreakdown: {
          directness: 1,
          completeness: 1,
          relevance: 1,
          trustworthiness: 1,
          decisionValue: 1,
          graceUnderAmbiguity: 1,
        },
      });
    }

    throw new Error(`Missing section 6 curation override for "${entry.prompt}"`);
  });

  await writeJson(BATCH_PATHS.six, updated);
}

function applyOverride(entry, override) {
  const score = override.score ?? entry.score;
  const verdict = override.verdict ?? entry.verdict;
  const scoreBreakdown = hasBreakdown(override.scoreBreakdown)
    ? override.scoreBreakdown
    : hasBreakdown(entry.scoreBreakdown)
      ? entry.scoreBreakdown
      : deriveBreakdown(score, entry);

  return {
    ...entry,
    ...override,
    score,
    verdict,
    usefulnessVerdict: override.usefulnessVerdict ?? entry.usefulnessVerdict ?? inferUsefulnessVerdict(verdict),
    scoreBreakdown,
  };
}

function buildTimeoutNotes(entry) {
  if (entry.primaryPersona === 'Competitive / Market Intelligence Analyst') {
    return 'The backend timed out before returning any evidence set, so the analyst gets no ranked changes, no supporting examples, and nothing they can act on.';
  }
  if (entry.primaryPersona === 'Agency / Business Development Prospector') {
    return 'The backend timed out before returning any lead list or evidence, so the prospector gets no candidates, no prioritization, and no basis for outreach.';
  }
  if (entry.primaryPersona === 'Publishing Strategy Lead') {
    return 'The backend timed out before returning any candidate screen, so the publishing lead gets no rescue, signing, or launch-readiness evidence to evaluate.';
  }
  if (entry.primaryPersona === 'Investor / Portfolio Analyst') {
    return 'The backend timed out before returning any ranked pivots or supporting data, so the portfolio analyst cannot assess the strategic signal at all.';
  }
  return 'The backend timed out before returning any answer or evidence, so the prompt is unusable in its current state.';
}

function hasBreakdown(scoreBreakdown) {
  return Boolean(
    scoreBreakdown &&
      Object.values(scoreBreakdown).every((value) => Number.isFinite(value))
  );
}

function inferUsefulnessVerdict(verdict) {
  if (verdict === 'Strong' || verdict === 'Good') return 'Useful';
  if (verdict === 'Mixed') return 'Partially useful';
  if (verdict === 'Weak' || verdict === 'Failure') return 'Not useful';
  return null;
}

function deriveBreakdown(score, entry) {
  if (entry?.status === 'error' || score < 3.5) {
    return {
      directness: 1,
      completeness: 1,
      relevance: 1,
      trustworthiness: 1,
      decisionValue: 1,
      graceUnderAmbiguity: 1,
    };
  }

  if (score >= 8.5) {
    return {
      directness: 5,
      completeness: 4,
      relevance: 5,
      trustworthiness: 5,
      decisionValue: 4,
      graceUnderAmbiguity: 4,
    };
  }

  if (score >= 8.0) {
    return {
      directness: 4,
      completeness: 4,
      relevance: 4,
      trustworthiness: 5,
      decisionValue: 4,
      graceUnderAmbiguity: 4,
    };
  }

  if (score >= 7.5) {
    return {
      directness: 4,
      completeness: 4,
      relevance: 4,
      trustworthiness: 4,
      decisionValue: 4,
      graceUnderAmbiguity: 4,
    };
  }

  if (score >= 7.0) {
    return {
      directness: 4,
      completeness: 4,
      relevance: 4,
      trustworthiness: 4,
      decisionValue: 3,
      graceUnderAmbiguity: 4,
    };
  }

  if (score >= 6.5) {
    return {
      directness: 4,
      completeness: 3,
      relevance: 4,
      trustworthiness: 4,
      decisionValue: 3,
      graceUnderAmbiguity: 4,
    };
  }

  if (score >= 6.0) {
    return {
      directness: 4,
      completeness: 3,
      relevance: 3,
      trustworthiness: 4,
      decisionValue: 3,
      graceUnderAmbiguity: 4,
    };
  }

  if (score >= 5.0) {
    return {
      directness: 4,
      completeness: 3,
      relevance: 2,
      trustworthiness: 3,
      decisionValue: 2,
      graceUnderAmbiguity: 3,
    };
  }

  return {
    directness: 2,
    completeness: 1,
    relevance: 1,
    trustworthiness: 1,
    decisionValue: 1,
    graceUnderAmbiguity: 2,
  };
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
