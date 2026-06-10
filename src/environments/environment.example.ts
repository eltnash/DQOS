/** Copy to environment.ts for local dev after creating a separate Supabase dev project. */
export const environment = {
  production: false,
  gatekeeperRelaxedExecution: true,
  supabaseUrl: 'https://YOUR_DEV_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_DEV_ANON_KEY',
};
