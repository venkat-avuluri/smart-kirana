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
To run the automated test suite verifying all 18 security, database, and role assertions:
```bash
cd server
node test-phase1.js
```

---

## 5. Deployment Recommendation

- **Database**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) Free/Dedicated Tier.
  - Update `MONGODB_URI` in server environment settings.
- **Backend**: [Render.com](https://render.com) or Railway.
  - Set Build Command: `cd server && npm install`
  - Set Start Command: `cd server && npm start`
  - Add environment variables (`MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `CORS_ORIGIN=https://your-frontend-domain.vercel.app`).
- **Frontend**: [Vercel](https://vercel.com).
  - Framework Preset: `Vite`
  - Root Directory: `client`
  - Configure Rewrite/API proxy or set `VITE_API_URL` to your live Render backend URL.

---

## 6. Development Roadmap Status

- [x] **Analysis & PRD**: Complete architecture, data models, schema, and API contract.
- [x] **PHASE 1: Foundation (COMPLETED & VERIFIED)**
  - Project setup, modular structure.
  - MongoDB connection with event handlers and reconnection.
  - JWT Authentication, bcrypt password hashing, RBAC middleware.
  - Initial database seeder for default Admin and Staff accounts.
  - React + Vite + Tailwind CSS v4 frontend with React Router.
  - Auth context, responsive application shell, login page with 1-click test helpers.
  - Role-guarded routes (Admin Dashboard vs Staff POS view vs Unauthorized prompt).
  - Admin staff account management (create staff, toggle status, safety guards).
  - Automated test suite passing 18/18 checks.
- [ ] **PHASE 2: Product & Category Management** *(Awaiting Approval)*
- [ ] **PHASE 3: Inventory Ledger & Stock Control**
- [ ] **PHASE 4: POS Billing & Invoicing**
- [ ] **PHASE 5: Customers, Udhaar & Purchases**
- [ ] **PHASE 6: Analytics & Financial Reports**
- [ ] **PHASE 7: Rigorous Testing & Deployment Readiness**
