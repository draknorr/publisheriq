// Cube.js configuration for PublisherIQ
// Deployed on Fly.io with in-memory caching

const jwt = require('jsonwebtoken');

/** @type {import('@cubejs-backend/server-core').CreateOptions} */
module.exports = {
  // Database connection
  dbType: 'postgres',

  // Use environment variables for connection
  // CUBEJS_DB_HOST, CUBEJS_DB_PORT, CUBEJS_DB_NAME, CUBEJS_DB_USER, CUBEJS_DB_PASS

  // In-memory caching (no Redis needed for low volume)
  cacheAndQueueDriver: 'memory',

  // Pre-aggregations stored in source database
  preAggregationsSchema: 'cube_pre_aggs',

  // JWT Authentication
  checkAuth: (req, auth) => {
    if (!auth) {
      throw new Error('No authorization token provided');
    }

    try {
      const decoded = jwt.verify(auth, process.env.CUBEJS_API_SECRET);
      req.securityContext = decoded;
    } catch (err) {
      throw new Error('Invalid authorization token');
    }
  },

  // Security context for multi-tenancy (single tenant for now)
  contextToAppId: ({ securityContext }) => 'publisheriq',

  // Scheduled refresh configuration
  scheduledRefreshContexts: () => [
    {
      securityContext: { internal: true },
    }
  ],

  // Refresh every 6 hours
  scheduledRefreshTimer: 60 * 60 * 6, // 6 hours in seconds

  // Allow Playground in development, disable in production via env
  devServer: process.env.CUBEJS_DEV_MODE === 'true',

  // API configuration
  apiSecret: process.env.CUBEJS_API_SECRET,

  // Telemetry
  telemetry: false,
};
