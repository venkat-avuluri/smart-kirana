# Smart Kirana - Retail Management & POS Billing System

> **A purpose-built, production-quality retail management and POS billing platform tailored for a physical Indian Kirana store.**

---

## 1. Business & Architectural Highlights

- **Store Type**: Single physical kirana store (<500 SKUs, primary device: Laptop, secondary: Mobile).
- **GST Status**: Unregistered retailer. Does not charge GST or generate tax invoices; prints retail counter cash memos / receipts.
- **Financial Precision Standard**: All monetary values (`sellingPrice`, `mrp`, `purchasePrice`, `totalAmount`, `discount`, `balance`) are strictly stored as **integer paise** (₹1.00 = `100` paise). This completely eliminates IEEE 754 floating-point arithmetic errors across daily register reconciliations and customer credit balances.
- **Negative Stock Handling**: Physical kiranas cannot stop counter billing if an item was received on the shelves but not yet entered into the software. Negative stock displays a prominent non-blocking alert, requires cashier confirmation, and logs an immutable ledger entry marked `isNegativeStockOverride: true`.
- **Dual Role Access Control (RBAC)**:
  - **`ADMIN` (Shop Owner)**: Full access to the entire store operations, inventory ledger adjustments, product & category catalog, supplier purchases, reports, and staff account management.
  - **`STAFF` (Counter Employees / Family)**: Streamlined POS billing, rapid barcode/name search, cash/UPI/Udhaar payment recording, customer ledger lookup. Restricted from backend administrative reports, cost prices, and user administration.

---

## 2. Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS v4, React Router v7, Lucide Icons, Axios, Recharts.
- **Backend**: Node.js, Express.js (ES Modules), JWT authentication, bcryptjs password hashing, helmet, morgan, express-rate-limit.
- **Database**: MongoDB (Local MongoDB / MongoDB Atlas), Mongoose ODM.
- **Testing**: Native automated test suite verifying health, JWT verification, role boundaries, and user lifecycle.

---

## 3. Project Directory Structure

```text
kiranaProject/
├── package.json               # Root orchestrator scripts
├── README.md                  # System documentation & setup guide
├── client/                    # Vite + React Frontend
│   ├── index.html             # App entry HTML
│   ├── vite.config.js         # Tailwind v4 plugin + API proxy config
│   ├── package.json           # Frontend dependencies
│   └── src/
│       ├── main.jsx           # React DOM root
│       ├── App.jsx            # Protected routing & role guards
│       ├── index.css          # Tailwind CSS v4 imports & theme
│       ├── components/
│       │   └── ProtectedRoute.jsx  # Role-based route guard
│       ├── context/
│       │   └── AuthContext.jsx     # User session & credentials state
│       ├── layouts/
│       │   └── AppLayout.jsx       # Responsive sidebar & header shell
│       ├── pages/
│       │   ├── LoginPage.jsx       # Login view with 1-click test helpers
│       │   ├── DashboardPage.jsx   # Admin analytics & retail KPIs
│       │   ├── UsersPage.jsx       # Staff account administration
│       │   ├── PosPlaceholderPage.jsx # POS register layout
│       │   └── UnauthorizedPage.jsx# 403 access restricted screen
│       ├── services/
│       │   └── api.js              # Axios client with JWT interceptor
│       └── utils/
│           └── formatters.js       # Indian Rupee (₹) & date formatters
└── server/                    # Node.js + Express Backend
    ├── package.json           # Backend dependencies
    ├── .env                   # Local environment variables
    ├── .env.example           # Production deployment template
    ├── test-phase1.js         # Automated Phase 1 test suite (18/18 checks)
    └── src/
        ├── server.js          # Express initialization & middleware
        ├── config/
        │   └── db.js          # MongoDB connection & reconnect logic
        ├── models/
        │   └── User.js        # Mongoose User model with bcrypt & RBAC
        ├── middleware/
        │   ├── auth.js        # JWT token verification
        │   ├── rbac.js        # Role-based access control (Admin vs Staff)
        │   └── errorHandler.js# Centralized error handler
        ├── controllers/
        │   └── authController.js # Login, me, user management
        ├── routes/
        │   └── authRoutes.js  # Mounted at /api/v1/auth
        └── utils/
            ├── jwt.js         # Token generation & verification
            └── seed.js        # Initial Admin & Staff accounts seeder
```

---

## 4. Setup & Running Instructions

### Prerequisites
- Node.js (v18 or higher recommended; tested on Node v24)
- MongoDB (Local service running at `mongodb://localhost:27017` or MongoDB Atlas URI)

### 1. Installation
Install dependencies for both client and server:
```bash
# In the project root:
npm run install:all

# Or separately:
cd server && npm install
cd ../client && npm install
```

### 2. Environment Configuration
Check `server/.env` (pre-configured for local development):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_kirana
JWT_SECRET=smart_kirana_secure_production_secret_key_2026
JWT_EXPIRES_IN=24h
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 3. Seed Initial Accounts
Populate the database with the default Admin (Shop Owner) and Staff accounts:
```bash
cd server
npm run seed
```

**Default Test Credentials:**
| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **ADMIN (Shop Owner)** | `admin` | `adminpassword123` | Full Dashboard, Staff Accounts, Catalog, Reports |
| **STAFF (Counter)** | `staff` | `staffpassword123` | POS Billing, Customer Udhaar, Sales History |

### 4. Running the Development Servers

Open two terminal tabs:
```bash
# Tab 1: Start Backend (Port 5000)
cd server
npm run dev

# Tab 2: Start Frontend (Port 5173)
cd client
npm run dev
```

Visit the application in your browser at: **`http://localhost:5173`**

### 5. Running the Automated Verification Tests
```bash
cd server
# Run Phase 1: Foundation & Authentication (18 checks)
node test-phase1.js

# Run Phase 2: Product & Category Management (21 checks)
node test-phase2.js

# Run Phase 3: Inventory Ledger & Stock Movement (31 checks)
node test-phase3.js

# Run Phase 4: POS Billing & Invoicing (36 checks)
node test-phase4.js

# Run Phase 5: Customers, Udhaar & Purchases (33 checks)
node test-phase5.js

# Run Phase 6: Reports & Analytics (42 checks)
node test-phase6.js

# Run Phase 7: Functional Audit, Rollbacks & Security (35 checks)
node test-phase7.js

# TOTAL: 216 / 216 tests passing (100% pass rate)
```

### 6. Database Utilities (Reconciliation, Backup & Recovery)
```bash
cd server

# Run Database Ledger Reconciliation Audit
npm run reconcile

# Create a full point-in-time database snapshot (JSON export with metadata)
npm run backup

# Restore database from a snapshot directory
npm run restore -- backups/backup-YYYY-MM-DDTHH-mm-ss-sssZ
```

---

## 5. Production Deployment Guide

### A. Database (MongoDB Atlas)
1. Create a free M0 cluster or dedicated instance on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user with read/write permissions to the `smart_kirana` database.
3. Under **Network Access**, add your backend server's IP (or `0.0.0.0/0` with a strong password).
4. Note your SRV connection string: `mongodb+srv://<username>:<password>@cluster0.mongodb.net/smart_kirana?retryWrites=true&w=majority`.
5. *Atlas Replica Sets*: Automatically support multi-document MongoDB transactions (`session.withTransaction`). For local laptop deployments without a replica set, Smart Kirana includes built-in automated **compensating ledger rollbacks** (`STOCK_CORRECTION`) guaranteeing 100% stock integrity on standalone instances.

### B. Backend Deployment (Render / Cloud VPS)
The backend includes a declarative infrastructure spec (`server/render.yaml`):
1. Connect your repository to [Render.com](https://render.com).
2. Select **Web Service** pointing to the `server/` directory.
3. Environment: `Node.js`, Build Command: `npm install`, Start Command: `node src/server.js`.
4. Health Check Path: `/api/health`.
5. Configure Production Environment Variables (refer to `server/.env.production.example`):
   - `PORT=5000`
   - `NODE_ENV=production`
   - `MONGODB_URI=<your-atlas-uri>`
   - `JWT_SECRET=<strong-random-64-character-string>`
   - `JWT_EXPIRES_IN=24h`
   - `CORS_ORIGIN=https://your-frontend.vercel.app` (comma-separated for multiple domains)

### C. Frontend Deployment (Vercel)
The frontend includes SPA routing configurations (`client/vercel.json`):
1. Import your GitHub repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `client`.
3. Framework Preset: **Vite**.
4. Configure Production Environment Variables (refer to `client/.env.production.example`):
   - `VITE_API_URL=https://your-backend.onrender.com/api/v1`
5. Deploy. Vercel automatically builds and deploys static assets with client-side SPA rewrites handled by `vercel.json`.

---

## 6. Development Roadmap Status

- [x] **Analysis & PRD**: Complete architecture, data models, schema, and API contract.
- [x] **PHASE 1: Foundation (COMPLETED & VERIFIED)**
  - Project setup, modular structure.
  - MongoDB connection with event handlers and reconnection.
  - JWT Authentication, bcrypt password hashing, RBAC middleware.
  - Initial database seeder for default Admin and Staff accounts.
  - React + Vite + Tailwind CSS v4 frontend with React Router.
  - Auth context, responsive application shell, login page.
  - Role-guarded routes (Admin Dashboard vs Staff POS view vs Unauthorized prompt).
  - Admin staff account management (create staff, toggle status, safety guards).
  - Automated test suite passing 18/18 checks.
- [x] **PHASE 2: Product & Category Management (COMPLETED & VERIFIED)**
  - Product model with integer paise pricing and price snapshot history.
  - Decimal quantity validation for loose items (`kg`, `g`, `L`, `ml`).
  - Integer quantity validation for discrete units (`piece`, `packet`).
  - Barcode uniqueness and fast barcode scanner lookup endpoint.
  - Category model with product count aggregation & deletion safety checks.
  - Product listing table with search, category filters, unit filters, low-stock filter.
  - Add & Edit Product modals with real-time margin and MRP checks.
  - RFC-4180 CSV parser, template generator, dry-run validation, and batch product importer.
  - Role permissions: Staff can search/view catalog; Admin only can create, edit, deactivate, or import products.
  - Automated test suite passing 21/21 checks.
- [x] **PHASE 3: Inventory Ledger & Stock Control (COMPLETED & VERIFIED)**
  - Immutable `InventoryTransaction` ledger schema with strict pre-save immutability protection.
  - Atomic stock movement engine (`recordStockMovement`) synchronizing ledger source of truth with cached product stock.
  - Stock-In receipt workflow for purchases.
  - Controlled Stock-Out workflow for damage, wastage, and manual deductions.
  - Initial shop opening stock workflow with duplicate opening stock prevention.
  - Bulk CSV opening stock import with dry-run validation preview.
  - Manual stock adjustments (target count vs relative delta).
  - Non-blocking negative stock alert with authorization override protocol and audit logging.
  - Store inventory valuation strictly calculated at purchase cost (`Sum(currentStock * purchasePricePaise)`).
  - Low-stock shortage alert center with 1-click restock actions.
  - Automated test suite passing 31/31 checks (total 70/70 passing across all suites).
- [x] **PHASE 4: POS Billing & Invoicing (COMPLETED & VERIFIED)**
  - Dedicated full-screen POS counter workspace (keyboard-first, `F2` search focus, auto-increment on repeated barcode scans).
  - Server-side price recalculation strictly enforcing database integer paise integrity (never trusts client price tampering).
  - Sequential unique invoice numbering (`SK-YYYYMM-XXXX`) and return voucher numbering (`RET-YYYYMM-XXXX`) without collisions.
  - Decimal quantities for loose provisions (`kg`, `g`, `L`, `ml`) with quick weight chips (`250g`, `500g`, `1kg`) and discrete integer enforcement.
  - Multi-payment support: Cash (quick denomination chips, tendered & live change calculator), UPI (with reference/UTR code), Split payment (Cash + UPI), and Udhaar store credit.
  - Atomic inventory deduction integrated into the immutable ledger (`type: 'SALE'`).
  - Non-blocking negative stock warning modal with cashier override authorization protocol and audit trail.
  - Idempotency protection preventing accidental duplicate billing on network retries.
  - Invoice voiding/cancellation (Admin only) with mandatory reason and automated stock restoration via ledger (`STOCK_CORRECTION`).
  - Sales returns (partial or full) with sold-quantity bounds validation and stock restoration (`SALE_RETURN`).
  - Dual-format printable receipts (Standard A4 and 80mm thermal roll formats with print-optimized CSS).
  - Sales & Receipts history view with pagination, date/payment filters, receipt reprinting, return processing, and voiding.
  - Automated test suite passing 36/36 checks (total 106/106 passing across Phases 1–4).
- [x] **PHASE 5: Customers, Udhaar & Purchases (COMPLETED & VERIFIED)**
  - Customer directory with unique phone index, address, notes, and instant autocomplete search.
  - Immutable `CustomerTransaction` credit ledger tracking credit sales, cash/UPI repayments, and void reversals.
  - Repayment collection workflow generating sequential cash receipts (`RCP-YYYYMM-XXXX`) with overpayment boundary protection.
  - Deep POS Udhaar integration: customer autocomplete dropdown, live credit balance preview, and automatic debt ledger postings.
  - Automatic customer credit debt reversal upon POS bill voiding (`SALE_VOID`).
  - Wholesale supplier/vendor management with contact details, notes, and payable ledger tracking.
  - Multi-item purchase entry (`PUR-YYYYMM-XXXX`) with atomic inventory ledger increments (`PURCHASE`) for loose and discrete goods.
  - Support for full payment, partial payment, and credit purchases with auditable `SupplierTransaction` payable ledger.
  - Supplier disbursement settlements generating payment vouchers (`SPAY-YYYYMM-XXXX`).
  - Admin-only purchase cancellation with automated inventory stock reversal (`STOCK_CORRECTION`) and supplier debt reduction.
  - Strict RBAC: Staff can manage customers, record customer repayments, and bill on Udhaar; Staff strictly blocked from supplier costs, wholesale purchasing, and supplier disbursements (403 Forbidden).
  - Automated test suite passing 33/33 checks (total 139/139 passing across Phases 1–5).
- [x] **PHASE 6: Analytics, Financial Reports & Intelligence Dashboard (COMPLETED & VERIFIED)**
  - Executive Business Dashboard with real-time KPIs: Today's net sales, total bills, average bill value, cash collections, UPI collections, customer Udhaar credit generated, inventory valuation (at cost), customer credit debt, supplier payables, and low-stock alerts.
  - Multi-range date filters: `Today`, `Yesterday`, `Last 7 Days`, `Last 30 Days`, `This Month`, `Previous Month`, and `Custom Range` (with start and end date pickers).
  - Pure database aggregations in integer paise, excluding voided sales and deducting sales returns.
  - Gross Profit calculation (`Gross Profit = Net Sales Revenue - COGS`) derived from immutable historical purchase price snapshots captured at checkout. Distinguishes revenue, gross profit, inventory valuation, and customer credit without reporting untracked operating net profit.
  - Interactive visual analytics via Recharts: Daily sales & gross profit area timeline, payment methods distribution donut/pie chart, top 5 best-selling products bar chart, and category revenue breakdown.
  - Product intelligence: Best-selling and least-selling product rankings with sold quantity, revenue, COGS, gross margin, and margin %.
  - Inventory analytics: Total valuation at purchase cost, category-wise valuation, low-stock shortage alerts, out-of-stock SKUs, and negative stock tracking.
  - Customer & Supplier ledger summaries: Outstanding credit to collect and supplier payables to disburse.
  - RFC-4180 CSV export suite: 1-click downloads for Sales Invoices, Product Profitability, Inventory Valuation, Customer Udhaar Balances, and Supplier Outstanding Payables.
  - Executive Printable Report view (`window.print()`) with print-optimized CSS formatting in Indian currency (₹).
  - Strict RBAC: All report APIs, wholesale costs, margins, and profit metrics restricted to `ADMIN` only (`403 Forbidden` for Staff).
  - Automated test suite passing 42/42 checks (total 181/181 passing across Phases 1–6).
- [x] **PHASE 7: Final Testing, Security Audit & Production Deployment (COMPLETED & VERIFIED)**
  - **End-to-End Workflow Testing**:
    - *Test A (Normal POS Sale)*: Search, cart, tax-exempt receipt, atomic inventory decrement (`SALE`), instant sales aggregation.
    - *Test B (Compensating Rollback on Failure)*: Simulated database crash or validation failure triggers automated ledger compensating reversals (`STOCK_CORRECTION`), leaving inventory 100% intact even without replica set transactions.
    - *Test C (Customer Udhaar Credit & Repayment)*: Credit sale records debt, repayment collection issues receipt (`RCP-`), and verifies correct outstanding balance.
    - *Test D (Wholesale Purchase & Supplier Payable)*: Purchase increases stock (`PURCHASE`), records credit payable, and payment voucher (`SPAY-`) settles account to ₹0 balance.
    - *Test E (Sales Return & Stock Restoral)*: Partial return on invoice, sold quantity bounds check, customer refund calculation, and inventory restoral (`SALE_RETURN`).
    - *Test F (Idempotency Protection)*: Duplicate checkout submissions with matching idempotency keys reject duplicate debits, returning the original invoice.
  - **Security Audit & RBAC Boundaries**:
    - Wholesale acquisition costs (`purchasePricePaise`) and `priceHistory` are strictly masked from `STAFF` users across all catalog endpoints, product queries, and sales receipt payloads (`.select('-purchasePricePaise -priceHistory')`). Staff only see selling price and MRP.
    - Login credentials default autofill removed from client interface for production security.
    - Multi-origin CORS support configured (`CORS_ORIGIN`).
    - API rate limiting (`apiLimiter`, 2,000 req/15min) protecting against DDoS or brute force.
  - **Ledger Reconciliation Engine**: Built standalone audit utility (`server/src/utils/reconcileLedgers.js`) and Admin endpoint (`GET /api/v1/reports/reconciliation`) detecting discrepancies across product stock, customer balances, supplier payables, and invoice math without silent mutations.
  - **Performance & Indexing**: Compound MongoDB indexes applied (`Product.index({ isActive: 1, currentStock: 1 })` and `Product.index({ category: 1, isActive: 1 })`).
  - **Backup & Disaster Recovery**: Built automated point-in-time snapshot and restore scripts (`npm run backup`, `npm run restore`).
  - **Deployment Readiness**: Created `client/vercel.json` SPA configuration, `server/render.yaml` infrastructure specification, and safe `.env.production.example` templates.
  - **Automated Verification**: Phase 7 test suite passing 35/35 checks (**total 216/216 passing across all 7 phases with 100% pass rate**).

---

## 7. Database Backup & Disaster Recovery Guide

Smart Kirana provides automated native backup and restore utilities to protect shop operational data:

### Taking a Database Backup
```bash
cd server
npm run backup
```
- Creates a timestamped directory under `server/backups/backup-YYYY-MM-DDTHH-mm-ss-sssZ/`.
- Dumps all collections as JSON files alongside a `metadata.json` manifest recording timestamps, Node version, and document counts.
- Recommended cadence: Run daily at shop closing (can be automated via Windows Task Scheduler or cron).

### Restoring from a Backup
```bash
cd server
npm run restore -- backups/backup-YYYY-MM-DDTHH-mm-ss-sssZ
```
- Validates the backup manifest and existence of collection dumps.
- Cleans and restores all collections, preserving ObjectID references and immutable ledger consistency.

---

## 8. 10-Step Real-World Kirana Shop Pilot Checklist

Follow this checklist before running the application on your physical counter laptop:

1. [ ] **Hardware Setup**: Position counter laptop, plug in 1D/2D USB or Bluetooth barcode scanner, and connect the 80mm thermal receipt printer (or standard desktop printer).
2. [ ] **Printer Test**: Print a test page from Windows/OS settings to verify thermal roll margins and paper auto-cutter.
3. [ ] **Environment Configuration**: Set strong `JWT_SECRET` and connect to persistent database (local MongoDB service or MongoDB Atlas replica set).
4. [ ] **Initial Database Seeding**: Run `npm run seed` to generate initial Owner (`admin`) and Cashier (`staff`) accounts.
5. [ ] **Password Security**: Immediately log in as `admin`, navigate to Users, and update default passwords for both accounts.
6. [ ] **Product Catalog Initialization**: Navigate to Products and import your initial shop inventory via CSV (use the provided sample template with names, categories, units, purchase prices, selling prices, and barcodes).
7. [ ] **Opening Stock Verification**: Confirm current shelf stock for loose items (`kg`, `L`) and discrete packets.
8. [ ] **Scanner Calibration**: Scan 5 diverse barcodes in the POS Billing interface to verify auto-detection, keyboard enter emulation, and fast quantity increments.
9. [ ] **Trial Counter Bill**: Perform a complete test sale with split payment (Cash + UPI), print the 80mm thermal receipt, and verify stock deduction in the Inventory view.
10. [ ] **Daily Closing Backup**: Run `npm run backup` at closing and verify that the backup folder is backed up to a secondary USB drive or cloud drive.

---

## 9. Security, Role Boundaries & Known Limitations

### Role Access Matrix
| Feature / Action | Admin (Owner) | Staff (Counter) | Protection Mechanism |
| :--- | :---: | :---: | :--- |
| **POS Billing & Invoicing** | Yes | Yes | Unrestricted counter operation |
| **Customer Directory & Udhaar** | Yes | Yes | Phone lookup & debt recording |
| **Customer Repayments** | Yes | Yes | Cash/UPI receipt generation |
| **Wholesale Purchase Prices** | **Yes** | **Hidden** | Stripped from queries & responses |
| **Supplier Purchases & Ledgers** | **Yes** | **Blocked** | 403 Forbidden |
| **Financial & Profit Reports** | **Yes** | **Blocked** | 403 Forbidden |
| **CSV Financial Exports** | **Yes** | **Blocked** | 403 Forbidden |
| **Bill Cancellation / Void** | **Yes** | **Blocked** | 403 Forbidden + Stock Reversal |
| **User & Staff Management** | **Yes** | **Blocked** | 403 Forbidden |

### Known Boundaries
- **Single Physical Store**: Architected for single-shop physical retail (<500 SKUs). Multi-store or multi-warehouse synchronization is intentionally not included in this release.
- **Unregistered GST Status**: Unregistered retail configuration printing retail counter memos rather than tax invoices with SGST/CGST breakdown.
- **No AI Dependencies**: All sales calculations, stock deductions, ledger balances, and financial analytics operate deterministically via pure database aggregations and arithmetic.
