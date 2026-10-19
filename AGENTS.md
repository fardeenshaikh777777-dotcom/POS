# AGENTS.md — Karachi Express POS

Restaurant management system for Karachi restaurants (POS, kitchen, inventory, cash closing).
Demo-grade presentation, but every implemented feature must use real logic and persistent database operations.

## 1. Existing-project audit (Phase 1, 2026-10-16)

| Area | Finding |
|---|---|
| Repository | **Empty** (no files, no git history, no Supabase config, no migrations). Nothing to preserve or migrate. |
| Environment | Node/npm exist at `C:\Program Files\nodejs` (not on sandbox PATH; run npm outside sandbox). Supabase CLI **not installed**; no Docker/DB available locally. |
| Consequence | Phase 1 is a greenfield foundation. |
| Remote DB (2026-10-16) | Supabase project `khwjtcpodjyfoufbkvwa` (region `ap-south-1`). Migrations 000001–000003 **applied**. Direct host is IPv6-only; use the session pooler `aws-0-ap-south-1.pooler.supabase.com:5432`, user `postgres.khwjtcpodjyfoufbkvwa`. DB password is never stored in the repo. |

DB workflow (password via prompt/env, never committed):

```
npx supabase db push --db-url "postgresql://postgres.khwjtcpodjyfoufbkvwa:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
npx supabase db query -f supabase/tests/rls_verification.sql --db-url "..."   # expect: RLS_TEST_RESULT passed=25 failed=0 (always rolls back)
npx supabase db advisors --type all --level warn --db-url "..."              # expect: No issues found
```

## 2. Stack

- Vite + React 18 + TypeScript (strict), React Router 6, Zod for validation, Supabase (Auth + Postgres + RLS), Vitest, ESLint.
- Vanilla CSS with design tokens (no Tailwind).
- Path alias `@/` → `src/`.

## 3. Architecture

```
src/
  app/          App shell, route table (routes.tsx)
  components/   Reusable UI kit (ui.tsx): Button, Card, Field, DataTable, Loading/Empty/ErrorState
  features/     One folder per module: auth/, pos/, kitchen/, orders/, menu/, inventory/, cash/, reports/, staff/
                (each: pages, hooks, api.ts for Supabase calls, schemas.ts for Zod)
  lib/          supabase.ts (client), modules.ts (route+role registry), errors.ts, format.ts
  styles/       tokens.css (design tokens), global.css (components/layout)
  types/        domain.ts (shared TS types; regenerate DB types in Phase 2)
supabase/migrations/   Ordered, forward-only SQL
```

Rules:
1. Pages contain no raw Supabase calls — put them in `features/<x>/api.ts`.
2. Every async view renders **loading, empty, and error** states via the shared components.
3. Navigation, routing and UI permission checks derive from `lib/modules.ts` only.
4. Errors surface through `toUserMessage()`; never show raw DB messages.
5. Validate all form input with Zod before calling the API; the server re-validates.
6. Money: PKR, `numeric(12,2)` in DB, formatted with `formatPKR`. Never trust client-computed totals.

## 4. Database conventions

- `snake_case`, `uuid` PKs (`gen_random_uuid()`), `timestamptz`, `created_at`/`updated_at` with trigger.
- Every operational table has `branch_id` → used by RLS.
- Enums for closed sets; `CHECK` constraints for invariants (non-negative money, qty > 0).
- Snapshots on order lines (`item_name`, `unit_price`) so menu edits never rewrite history.
- Idempotency: `orders.client_request_id` and `payments.idempotency_key` are unique per branch.
- Append-only ledgers: `stock_movements`, `audit_log` (update/delete blocked by trigger). `inventory_items.current_qty` is maintained by trigger and cannot go negative.
- Migrations are forward-only; never edit an applied migration — add a new one.
- Business date uses `Asia/Karachi`.

## 5. Security requirements

- Browser uses **only** the anon key. Service-role key must never appear in `src/`, any `VITE_*` var, or git. `.env` is gitignored.
- RLS enabled on **every** table. Roles: `owner` (all branches), `manager`, `cashier`, `waiter`, `kitchen` (own branch only).
- Clients have **read-only** access to transactional tables (orders, payments, cash, stock ledger, audit); `INSERT/UPDATE/DELETE` is revoked. Writes go through `SECURITY DEFINER` RPCs (Phase 2) that check role, branch, totals, idempotency. All such functions must `set search_path = public` and be granted only to `authenticated`.
- `profiles` has no client write policy (prevents self role-escalation).
- PINs: optional, bcrypt-hashed (`pgcrypto crypt`), **no default PIN**, attempt counter + lockout columns exist. PIN verification only server-side.
- Never commit seed accounts with real/predictable credentials.

## 6. Design system — "Premium Operational Console"

Charcoal chrome (`--c-*`), warm-white surfaces (`--w-*`), a single restrained amber accent (`--amber-*`) used for active nav, primary-accent actions and focus rings only. IBM Plex Sans (UI) + IBM Plex Mono (figures, `.num`). 4px spacing scale. No decorative gradients. Minimum touch target 44px (`--touch`). Tables are dense, right-aligned numerics. Responsive: sidebar collapses to a top bar below 860px.

## 7. Implementation phases

1. **Foundation** (this phase): audit, schema, RLS, design system, auth, route/module structure.
2. Secure RPCs: `create_order` (idempotent), `settle_payment`, `open/close_cash_session`, `adjust_stock`, staff provisioning + PIN set/verify; generate DB types; seed script (no default PINs).
3. POS + Menu management + Orders.
4. Kitchen display (realtime) + inventory with recipe consumption.
5. Payments (cash, card, JazzCash/Easypaisa) with webhook persistence (Edge Function, service key server-side only).
6. Cash closing + reports + dashboard.
7. Offline queue (IndexedDB) replaying idempotent RPCs; hardening, e2e tests.

## 8. Implementation checklist

- [x] Repo audit
- [x] Project scaffold, strict TS, lint, test
- [x] Schema migration (branches, profiles, menu, tables, orders, payments, cash, inventory, audit, recipes, reservations, suppliers, POs, expenses, customers)
- [x] RLS migration + role helpers
- [x] Design tokens + UI kit + app shell
- [x] Auth (email/password), role-gated routes, demo quick-switchers
- [x] Secure RPCs for all transactional writes (`create_order`, `settle_payment`, `update_order_status`, `open_cash_session`, `close_cash_session`, `record_cash_movement`, `record_expense`, `adjust_stock`, `create_purchase_order`, `receive_purchase_order`, `verify_staff_pin`, `set_staff_pin`, `get_owner_dashboard_metrics`)
- [x] Verify migrations on real Supabase instance (`khwjtcpodjyfoufbkvwa`, migrations 000001–000006 applied)
- [x] RLS automated tests per role/branch (`supabase/tests/rls_verification.sql`, 25/25 passed)
- [x] Supabase security + performance advisors clean
- [x] Realtime publication enabled on orders, order_items, dining_tables, cash_sessions, table_reservations
- [x] All 14 feature modules fully implemented and connected to database (Dashboard, POS, Orders, Kitchen KDS, Menu, Tables, Inventory, Purchasing, Cash, Expenses, Reports, Customers, Staff, Settings)
- [x] Thermal receipt modal (80mm standard format with print styles)
- [x] Offline order queue with sync retry and visible sync status

## 9. Risk register

| Risk | Status / Mitigation |
|---|---|
| Migrations verified | Applied to the live project; 25 RLS/invariant checks pass; advisors report no issues. Re-run the test file after every new migration. |
| Online payment persistence | `payments` table with `status`, `provider_reference` (unique per method) and `idempotency_key`; webhook handler must write via service role in an Edge Function and be replay-safe. Not yet built. |
| Offline order sync | `orders.client_request_id` unique per branch enables safe replay. Queue not yet built; conflicts on stock/price resolved server-side. |
| Duplicate orders | Unique `(branch_id, client_request_id)`; UI must disable submit while pending and reuse the id on retry. |
| Predictable default PINs | No default PIN: `pin_hash` is NULL until explicitly set; lockout columns present. Verification RPC pending. |
| Inventory consistency | Append-only ledger + trigger-maintained quantity with `CHECK >= 0` (a sale that would go negative fails atomically). Order-to-stock deduction must run inside the same transaction as order creation (Phase 2/4). |
| Cash-closing accuracy | One open session per branch (partial unique index); cash payments require a session; `expected_cash` is computed server-side at close from opening float + succeeded cash payments + pay-ins − pay-outs/expenses (RPC pending). |
| Owner has `branch_id` NULL | `has_branch_access` special-cases owner; any new policy must use the helper, never compare `branch_id` directly. |
| Order totals | Columns are plain numerics; integrity depends on the RPC computing them. Direct writes are revoked. |
| Auth bootstrap | First owner must be created manually via Supabase dashboard + SQL insert into `profiles` (documented in README). |

## 10. Commands

`npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`
