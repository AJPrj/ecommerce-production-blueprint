# E-Commerce Production Implementation Tracker

This document serves as the master plan and progress tracker for the production e-commerce application. It enforces a strict "strong foundation first" approach, ensuring architecture, security, and data integrity are prioritized before building complex features.

## Phase 1: Local Infrastructure & Project Scaffolding 
*Goal: Establish the foundation for a reliable development lifecycle.*

- [x] **1.1 Local Dev Environment**
  - [x] Set up `docker-compose.yml` (PostgreSQL 16, Redis).
  - [x] Define initial `.env` configuration template.
- [x] **1.2 Backend (Spring Boot) Bootstrap**
  - [x] Scaffold Java 21 + Spring Boot 3.x project.
  - [x] Configure modular monolith package structure.
  - [x] Configure global exception handling and RFC 7807 problem details.
  - [x] Setup Flyway for database migrations.
  - [x] Configure Spotless/Checkstyle for code formatting.
- [x] **1.3 Frontend (React) Bootstrap**
  - [x] Scaffold Vite + React + TypeScript project.
  - [x] Setup folder structure (`features`, `components`, `api`, `store`).
  - [x] Configure ESLint, Prettier, and absolute imports.
  - [x] Setup unified API client (Axios) with interceptors for error handling.
  - [x] Setup custom Bootstrap 5 SASS design system.

## Phase 2: Core Domain, Security & Identity
*Goal: Secure the application and manage users/roles before any business logic.*

- [x] **2.1 Database Schema (Identity)**
  - [x] Flyway migration: Users, Roles, Permissions tables.
- [x] **2.2 Spring Security Implementation**
  - [x] Setup Authentication (Session/Cookie based via Redis, or JWT).
  - [x] Configure CORS and CSRF protection.
  - [x] Implement method-level security (Role-based access).
- [x] **2.3 Customer & Admin Authentication (API + UI)**
  - [x] Backend: Registration, Login, Logout, Session validation endpoints.
  - [x] Frontend: Auth context/store, protected route guards.
  - [x] Frontend: Login & Registration screens.

## Phase 3: Catalog & Inventory Management
*Goal: Build the engine that manages products and tracks physical stock.*

- [x] **3.1 Database Schema (Catalog)**
  - [x] Flyway migration: Categories, Products, Variants, Attributes, Images.
  - [x] Flyway migration: Inventory (On-hand, Reserved, Available) and Audit trails.
- [x] **3.2 Backend Catalog APIs**
  - [x] Admin APIs: CRUD operations, Bulk CSV/Excel imports.
  - [x] Public APIs: Product listing, Search, Filtering, Details.
  - [x] Implement row-level locking for inventory reservations.
- [x] **3.3 Frontend Catalog (Admin)**
  - [x] Product DataGrid with server-side pagination.
  - [x] Complex Product Editor form (Pricing, Variants, Inventory).
- [x] **3.4 Frontend Storefront (Customer)**
  - [x] Homepage with Promos and Categories.
  - [x] Product Listing Page (PLP) with robust filtering.
  - [x] Product Details Page (PDP) with variant selection.

## Phase 4: Cart, Pricing & Tax Engine
*Goal: Ensure all financial calculations are 100% server-authoritative.*

- [x] **4.1 Cart & Pricing Backend**
  - [x] Redis schema for session-based shopping carts.
  - [x] Pricing Engine: Calculate base price, discounts, and tier pricing.
  - [x] Tax Engine: Configurable GST/Tax calculation logic.
- [x] **4.2 Frontend Cart Experience**
  - [x] Interactive Cart slide-over/drawer.
  - [x] Cart summary with live server-recalculated totals.

## Phase 5: Checkout, Orders & Payments
*Goal: Handle money and orders with zero data loss or concurrency bugs.*

- [x] **5.1 Database Schema (Orders)**
  - [x] Flyway migration: Order, OrderItems (Immutable Snapshots).
  - [x] Flyway migration: Outbox pattern and Idempotency tables.
- [x] **5.2 Checkout & Order Backend**
  - [x] Validate checkout snapshot and lock inventory.
  - [x] `Idempotency-Key` implementation for order creation.
  - [x] Payment Intent creation API.
  - [x] Payment Webhook processor (with replay safety).
  - [x] Order State Machine implementation.
- [x] **5.3 Frontend Checkout Flow**
  - [x] Multi-step checkout (Address, Delivery, Payment, Review).
  - [x] Resilient retry logic for payment failures.
  - [x] Order Confirmation page & Order History.

## Phase 6: Commercial Operations & Fulfillment
*Goal: The real-world physical logistics of e-commerce.*

- [x] **6.1 Logistics Backend**
  - [x] Shipment state machine and Carrier API integrations.
  - [x] Reverse logistics (Returns & Refunds) APIs.
- [x] **6.2 Background Jobs & Communications**
  - [x] Setup distributed locking (e.g., ShedLock).
  - [x] Abandoned cart recovery job.
  - [x] Transactional Notifications (Email/SMS event listeners).
- [x] **6.3 Admin Dashboards**
  - [x] Fulfillment workflow screens.
  - [x] Financial reconciliation & Reports.

## Phase 7: Hardening, Performance & Launch Readiness
*Goal: Ensure the system can survive production traffic and malicious actors.*

- [x] **7.1 Performance Tuning**
  - [x] Eliminate N+1 queries in PostgreSQL.
  - [x] Optimize database indexes.
  - [x] Frontend bundle analysis and lazy loading.
- [x] **7.2 Observability**
  - [x] Configure structured JSON logging.
  - [x] Setup Micrometer metrics (Prometheus/Grafana readiness).
- [x] **7.3 Testing & CI/CD**
  - [x] Backend Unit & Integration tests for critical paths (Pricing/Checkout).
  - [x] Automated staging deployments.
- [x] **7.4 Security Review**
  - [x] Rate limiting, PII anonymization workflows.
  - [x] Final disaster recovery (Backup/Restore) drill.
