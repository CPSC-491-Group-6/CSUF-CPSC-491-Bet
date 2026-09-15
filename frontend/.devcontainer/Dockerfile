FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

# Keep the frontend image small while retaining SQLite CLI access for
# inspecting the project's local database during development.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        sqlite3 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development
