/**
 * Qdrant Client for PublisherIQ
 *
 * Singleton client with connection pooling and error handling.
 */

import { QdrantClient } from '@qdrant/js-client-rest';

let qdrantInstance: QdrantClient | null = null;

/**
 * Get or create Qdrant client instance
 */
export function getQdrantClient(): QdrantClient {
  if (qdrantInstance) {
    return qdrantInstance;
  }

  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url) {
    throw new Error('Missing QDRANT_URL environment variable');
  }

  if (!apiKey) {
    throw new Error('Missing QDRANT_API_KEY environment variable');
  }

  qdrantInstance = new QdrantClient({
    url,
    apiKey,
    timeout: 30000, // 30 second timeout
  });

  return qdrantInstance;
}

/**
 * Check if Qdrant is configured
 */
export function isQdrantConfigured(): boolean {
  return Boolean(process.env.QDRANT_URL && process.env.QDRANT_API_KEY);
}

/**
 * Test connection to Qdrant
 */
export async function testConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    const client = getQdrantClient();
    // Use getCollections as a simple health check
    await client.getCollections();
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Reset client instance (for testing)
 */
export function resetClient(): void {
  qdrantInstance = null;
}
