# Shopify Roadmap (3 Sprints)

## Sprint 1 — Foundation (1-2 weeks)
- Define catalog model in Shopify:
  - Products, variants, handles, SKU policy
  - Collections: Solara, Undara, Terrae, Lunara, Aeris, Ignis, Herbae
  - Metafields: lead time, MOQ, material, feng shui element, sample availability
- Build theme information architecture:
  - Home, collection listing, product detail, process, contact
  - Legal pages (privacy, terms)
- Implement baseline tracking:
  - `page_view`, `add_to_cart`, `begin_checkout`, `generate_lead`
- Configure enquiry endpoint integration (CRM or middleware)

## Sprint 2 — Conversion System (1-2 weeks)
- Replace static product cards with Shopify product data (Liquid/Storefront API)
- Add product detail pages with:
  - Indicative €/m2
  - Surface input (m2)
  - Sample request option
  - Lead time and materials
- Enquiry flow:
  - Form validation
  - Server-side lead capture
  - Automated email acknowledgement
- Trust/credibility:
  - Social profiles
  - Press and sustainability content
  - Policy pages and cookie/consent handling

## Sprint 3 — Scale & Performance (1-2 weeks)
- International setup:
  - Shopify Markets, localized content/currency
- Automation:
  - Flow automations for lead routing and follow-up
  - Draft order / quote pipeline
- Advanced analytics:
  - GA4 + Meta events parity
  - Funnel dashboards and attribution checks
- Performance and SEO:
  - Structured data expansion (Product, Breadcrumb, FAQ)
  - Image optimization and CWV tuning

## Already Implemented In This Repo
- Fixed broken collection links from home to `pages/collections.html#...`
- Added SEO baseline meta/canonical tags on core pages
- Added shared ecommerce runtime (`assets/js/ecommerce.js`)
- Added event dispatch in cart/contact flows
- Added endpoint-ready enquiry transport via `window.ANAVAI_CONFIG.enquiryEndpoint`
- Added legal/support pages:
  - `pages/privacy.html`
  - `pages/terms.html`
  - `pages/sustainability.html`
  - `pages/press.html`
