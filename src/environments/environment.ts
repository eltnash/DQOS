/**
 * Local `ng serve` — use your *dev* Supabase project here once created (Settings → API).
 * Until then this may still point at production; Coolify dev/staging should use build args instead.
 */
export const environment = {
  production: false,
  gatekeeperRelaxedExecution: true,
  supabaseUrl: 'https://pgxxsivodspkycdvcpur.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBneHhzaXZvZHNwa3ljZHZjcHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTM5MTAsImV4cCI6MjA5NjM2OTkxMH0.vkwiKlCWAWn9_gmniOLM2aJbDCTQQh-zt_ZFvIz759I',
};
