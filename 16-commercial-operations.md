# PART XVI — Commercial Operations

## 1. Logistics and Fulfillment

### Carrier Integrations
Real-world physical operations require automated carrier interactions. 
- Integration with logistics aggregators (e.g., Shiprocket, Delhivery, FedEx) is required.
- The system must support generating Airway Bills (AWBs), fetching live shipping rates, and generating printable shipping labels.
- Order tracking should rely on carrier webhooks mapped to internal shipment state machines.

### Reverse Logistics
- **Return Pickup:** Returns must schedule a reverse pickup via the carrier API.
- **Quality Check (QC):** Returned items must enter a QC state before an automated refund is issued. If QC fails, the system must support rejecting the refund and initiating a return-to-customer flow.

### Partial Fulfillment & Split Shipments
- An order might be fulfilled from multiple warehouses or require splitting if an item is out of stock.
- The system must support creating multiple Shipments per Order.
- Partial cancellations must trigger partial refunds without corrupting the original order snapshot.

## 2. Marketing, Growth & SEO

### Catalog Feeds
- Automated generation of XML/CSV product feeds is required to sync the catalog with Google Merchant Center, Meta (Facebook/Instagram) Catalogs, and affiliates.

### Abandoned Cart Recovery
- A background worker must identify carts inactive for a configurable duration (e.g., 2 hours, 24 hours).
- Trigger targeted Email/SMS/WhatsApp drip campaigns (e.g., via SendGrid or Twilio) containing deep links to resume checkout.

### Unified Analytics Event Bus
- The frontend must implement an abstraction layer (Event Bus) for analytics rather than cluttering UI components.
- Standard e-commerce events (ViewItem, AddToCart, BeginCheckout, Purchase) should be pushed to the data layer to be consumed by Google Tag Manager (GTM), GA4, and Meta Pixel.

## 3. Payments and Financial Operations

### Regional Payment Context (India)
- Provide tailored UX and backend handling for UPI Intents, NetBanking, and BNPL (Buy Now Pay Later).
- Payment gateways handle standard webhooks, but the backend must accommodate payment aggregator routing failures and dynamic downtimes.

### Refund Routing (Fallback)
- If a gateway fails to process a refund to the original payment source (e.g., expired card, certain UPI failures), the system requires a manual refund workflow.
- Securely collect customer bank details (Account + IFSC) and process NEFT/IMPS refunds manually or via an API payout service.

### Pricing Tiers
- The pricing engine must be extensible to support B2B pricing tiers, customer-specific overrides, and bulk/quantity discounts, extending beyond simple B2C per-variant pricing.

## 4. Catalog Management and Bulk Operations

### Bulk Import and Export
- Admin UI must support asynchronous, durable bulk operations for SKUs.
- Uploading CSV/Excel files for Products, Inventory, and Prices must generate a background job.
- Admins must receive success/failure reports per row upon job completion.

### Advanced Search Readiness
- While PostgreSQL full-text/trigram search is the day-one solution, the architecture must abstract the search interface.
- Plan for an eventual migration to OpenSearch/Elasticsearch to support typo tolerance, robust synonym dictionaries, and faceted search weighting at scale.

## 5. System and Infrastructure Nuances

### Distributed Locking
- As the modular monolith scales horizontally across multiple Kubernetes pods, background jobs (e.g., cron-based invoice generation, cart abandonment) must not execute concurrently on multiple instances.
- Implement distributed locking mechanisms (e.g., ShedLock with PostgreSQL or Redis) for scheduled tasks.

### Notification Templating
- Externalize email, SMS, and WhatsApp templates.
- Use a robust third-party provider (e.g., SendGrid, AWS SES) or an internal templating engine (e.g., Thymeleaf) mapped to domain events rather than hardcoding message bodies in business logic.

## 6. Privacy and Legal Compliance

### Data Protection (DPDP / GDPR)
- **Cookie Consent:** Frontend must include region-aware cookie consent management prior to activating marketing/analytics trackers.
- **Right to be Forgotten:** Implement a workflow for account deletion requests. Customer PII (name, email, phone) must be anonymized or hard-deleted.
- **Audit Preservation:** Financial records (Orders, Invoices) must retain referential integrity and legal compliance even after customer PII is scrubbed.
