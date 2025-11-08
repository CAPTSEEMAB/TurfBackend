// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'apiserver',
    script: 'index.js',

    // Default = DEV
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      API: '/api',
      ALLOWED_ORIGINS: '',
      SUPABASE_URL: 'https://dqhldoftulclyjdbzoqu.supabase.co',
      SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaGxkb2Z0dWxjbHlqZGJ6b3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzI4MDQsImV4cCI6MjA3NDc0ODgwNH0._FP1olIAy-lMZJ7UnKdMpI01EaG1e7kSnBTl9oQxmKg',        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaGxkb2Z0dWxjbHlqZGJ6b3F1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTE3MjgwNCwiZXhwIjoyMDc0NzQ4ODA0fQ.HZlbAZyX1XK45Uioc8q1Zr-JRcLIBiCdKS8JBZ_pjOI',
      JWT_SECRET: 'jQqzjE5CBynVJkr8fvsjcVcEd3LG1OduE1bdspgfR2/bcR3ViVG+SJjlVM5Gb3FGozqqbTJoKxpb4fV8YAj2VA==',
      // SERVER_PUBLIC_URL: 'http://localhost:3000',
    },

    // PM2 --env production
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      API: '/api',
      SERVER_PUBLIC_URL: 'http://35.174.214.46',
ALLOWED_ORIGINS: '',
      SUPABASE_URL: 'https://dqhldoftulclyjdbzoqu.supabase.co',
      SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaGxkb2Z0dWxjbHlqZGJ6b3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzI4MDQsImV4cCI6MjA3NDc0ODgwNH0._FP1olIAy-lMZJ7UnKdMpI01EaG1e7kSnBTl9oQxmKg',        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaGxkb2Z0dWxjbHlqZGJ6b3F1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTE3MjgwNCwiZXhwIjoyMDc0NzQ4ODA0fQ.HZlbAZyX1XK45Uioc8q1Zr-JRcLIBiCdKS8JBZ_pjOI',
      JWT_SECRET: 'jQqzjE5CBynVJkr8fvsjcVcEd3LG1OduE1bdspgfR2/bcR3ViVG+SJjlVM5Gb3FGozqqbTJoKxpb4fV8YAj2VA==',
    }
  }]
};
