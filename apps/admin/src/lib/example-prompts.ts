/**
 * Example prompts for the chat interface
 * Displayed randomly on the dashboard and chat pages
 */

export const EXAMPLE_PROMPTS = [
  // Game Discovery
  "Find me Steam Deck verified roguelikes with great reviews",
  "What are the best VR games on Steam?",
  "Show me co-op games that work on Linux",
  "Find indie games released this year with overwhelmingly positive reviews",
  "What free-to-play games have the most players right now?",

  // Publisher/Developer Discovery
  "What publisher has the most games on Steam?",
  "Show me all games by FromSoftware",
  "Which indie developers have multiple hit games?",
  "What publishers are releasing the most games this year?",

  // Franchise & Series
  "What games are in the Half-Life franchise?",
  "Show me all the DLC for Elden Ring",
  "Find games in the same series as Dark Souls",

  // Trends & Analytics
  "What games are trending up in reviews right now?",
  "Which popular games are getting worse reviews lately?",
  "What genres have the most new releases?",
  "Show me games that went from Mixed to Positive reviews",

  // Comparisons & Lists
  "Compare the review scores of Valve's games",
  "What are the highest-rated games with controller support?",
  "Show me RPGs with high Metacritic scores",
  "Which multiplayer games have the best reviews?",
];

/**
 * Returns a random selection of example prompts
 * @param count Number of prompts to return (default: 4)
 */
export function getRandomPrompts(count: number = 4): string[] {
  const shuffled = [...EXAMPLE_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
