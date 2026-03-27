/* Optional runtime config for enquiry + analytics integrations.
   Copy values to assets/js/anavai-config.js (module) or define window.ANAVAI_CONFIG inline before ecommerce runs. */
const DEFAULT_CONFIG = {
  currency: "EUR",
  demoMode: true,
  enquiryEndpoint: "https://anavai-enquiry-worker.<your-subdomain>.workers.dev/api/enquiry",
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"
};

export default DEFAULT_CONFIG;
