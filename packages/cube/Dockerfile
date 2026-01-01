# Cube.js Docker image for Fly.io deployment
FROM cubejs/cube:v1.1.8

# Set working directory
WORKDIR /cube

# Copy configuration and schema files
COPY cube.js .
COPY model ./model

# Expose Cube.js API port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4000/readyz || exit 1

# Start Cube.js server
CMD ["node", "/cube/node_modules/.bin/cubejs-server"]
