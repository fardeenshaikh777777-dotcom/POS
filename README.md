# Karachi Express POS — Restaurant Management & POS System

A high-performance, operational restaurant management platform tailored for Karachi dining establishments, featuring Point of Sale (POS), live Kitchen Display System (KDS), inventory ledger, cash session closing, and multi-period analytics.

## 🚀 Features

- **Point of Sale (POS)**: Fast dine-in, takeaway, and delivery order placement with table mapping, customer lookup, and split payments (Cash, Card, JazzCash, Easypaisa).
- **Kitchen Display System (KDS)**: Real-time ticket queue with live status transitions (`sent_to_kitchen` ⟶ `preparing` ⟶ `ready` ⟶ `served`).
- **Operational Dashboard**: Real-time sales metrics, hourly order breakdown, dynamic period filtering (Today's, This Week, This Month), and payment method radial gauge.
- **Inventory & Recipes**: Stock movement ledger with automatic deductions, recipe linking, low-stock alerts, and purchase orders.
- **Cash Management**: Cash session opening floats, pay-ins, pay-outs, expected vs. counted cash reconciliation, and discrepancy audits.
- **Thermal Receipt Printing**: 80mm standard thermal receipt format with printable modal and order summary.
- **Offline Resilience**: Offline order queue with sync retry and visible sync indicators.
- **Role-Based Access Control (RLS)**: Fine-grained permissions for `owner`, `manager`, `cashier`, `waiter`, and `kitchen`.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript (Strict), React Router 6, Zod, Vanilla CSS (Design Tokens).
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, Realtime Publications, Secure Transactional RPCs).
- **Testing & Quality**: Vitest, ESLint, TypeScript compiler.

## 📋 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/fardeenshaikh777777-dotcom/POS.git
   cd POS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your Supabase project credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

6. Run tests & typecheck:
   ```bash
   npm run typecheck
   npm test
   ```

## 🗄️ Database Migrations

Database migrations are located in `supabase/migrations/`:
- `000001_core_schema.sql` — Base tables, constraints, and audit logging.
- `000002_rls_policies.sql` — Row level security and role helpers.
- `000003_advisor_hardening.sql` — Query performance and index optimization.
- `000004_core_features_schema.sql` — Feature schema extensions.
- `000005_secure_rpcs.sql` — Idempotent transactional RPCs.
- `000006_realtime_and_seed.sql` — Realtime publication and demo restaurant seed.
- `000007_fix_dashboard_metrics.sql` — Live metrics RPC enhancements.
- `000008_fix_security_definer_grants.sql` — Security definer permission hardening.

## 📄 License

Proprietary — All rights reserved.
