# SpiceLedger — Version 1 starter

A lightweight React + Supabase business-records app for a spices business.

## Included
- Customer master records
- Product master with default rate
- Product-wise bills
- KG and gram quantities (rates are entered per KG)
- Payment entries
- Customer-wise total billing, paid amount and balance
- Basic overview and records screens

## Important before using real data
This starter is not yet deployed and is not connected to a database. Do not enter real customer information until you complete the secure setup below.

## Run locally
1. Install Node.js (LTS).
2. Extract this folder.
3. Open a terminal in this folder and run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the local URL printed by Vite.

## Connect Supabase
1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Enable Email/Password authentication. Disable public sign-ups after creating your own admin account.
4. Create your own account, then add its auth user UUID to `public.admin_allowlist` using the Supabase SQL editor (project owner only).
5. Copy `.env.example` to `.env` and fill in the Supabase Project URL and publishable/anon key.
6. Restart `npm run dev`.

The browser key is the publishable/anon key, not the `service_role` secret. Never put a service-role key in frontend code. The SQL schema uses Row Level Security and an explicit admin allowlist.

## Important design notes
- Customer master fields are stored as records; editing/deleting customer details is not exposed in this first UI.
- Product default rates are suggestions; each bill item stores its own rate per KG.
- Gram quantity is converted to KG for calculation: grams / 1000 × rate per KG.
- Outstanding = total bills - total recorded payments. It is a simple account balance, not an order/pending-order tracker.
- Backups, deployment, authentication UI, bill editing/deletion, payment correction, audit log UI and production-grade validation should be completed before business use.
- Use a real, tested backup plan. Cloud hosting alone is not a backup guarantee.
