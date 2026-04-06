# AthleteIQ — Full Session Summary & Founder Context

## Founder Mode Identity

**Role**: Lead Product Strategist & Co-Founder for AthleteIQ  
**Founder**: Jinesh — 21-year-old National Champion athlete  
**This is a market-ready startup, NOT a school/college project.**

---

## Business Context

| Item | Detail |
|------|--------|
| **Target Market** | Small-to-medium Indian sports academies (starting in Pune) |
| **Value Proposition** | Turning local clubs into "Elite Performance Centers" through tech |
| **Win Strategy** | Save the Coach time + prove ROI to the Parent |
| **Competitors** | Not global tools — the real competitor is "doing nothing" |

---

## Product Features (Current Build)

| Feature | Status |
|---------|--------|
| **Role-Based Access** — Admin, Sport-Specific Coach, Athlete, Parent | ✅ Live |
| **Bulk Session Logger** — 3-step, 3-minute squad logging | ✅ Live |
| **AI Engine** — ACWR + Deception Flagging + Readiness Scores (0-100) via Groq | ✅ Live |
| **Drill Centre / Session Planner** — AI-generated sport-specific plans | ✅ Live |
| **Parent Recovery Portal** — Narrative AI insights + "Home Recovery Advice" | ✅ Live |
| **Mental Performance** — Box Breathing, 4-7-8, Body Scan, Visualization | ✅ Live |
| **Injury Log** — Coach, Athlete, Parent views; active injury pill in profile | ✅ Live |
| **Attendance Tracker** — Present/Absent buttons, 30-day visual grid | ✅ Live |
| **Weekly Report** — AI-generated, locked after generation, PDF export via html2pdf.js | ✅ Live |
| **Razorpay Payment Integration** — Full checkout flow with webhook verification | ✅ Live |

---

## Tech Stack

| Layer | Technology | Tier |
|-------|-----------|------|
| **Frontend** | React (Create React App) | Vercel Free |
| **Backend** | FastAPI (Python) | Render Free |
| **Database** | Supabase (PostgreSQL) | Free |
| **AI** | Groq API (fast inference) | Free |
| **Payments** | Razorpay (test mode currently) | Free |
| **Uptime** | UptimeRobot (pings every 5 min to prevent Render cold starts) | Free |

### Current URLs
- **Frontend**: `https://athlete-iq-dun.vercel.app` → being changed to `https://athleteiq.vercel.app`
- **Backend**: `https://athleteiq-9r76.onrender.com`
- **Domain planned**: `athleteiq.in` (buying next month)

---

## What Was Built/Fixed in Previous Session

### 1. Attendance → Log Session Filter
- **Problem**: Absent athletes appeared in the Bulk Log modal — bad data skewing ACWR
- **Fix**: `BulkLogModal` now receives only `visibleAthletes.filter(a => attendance[a.name.toLowerCase().trim()] === 'present')`
- Guard added: alert if no athletes marked present before opening modal

### 2. Razorpay Payment Integration (Full End-to-End)
- **Backend**: `routes/payments.py` — `/create-order`, `/verify`, `/webhook` endpoints
- **Frontend**: `UpgradeModal.jsx` — plan selector with tabs, feature lists, per-athlete cost math
- **Flow**: Create Order → Razorpay Checkout → Verify Signature → Update Supabase `academies.plan = 'paid'`
- **Env vars on Render**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- **Database columns added**: `paid_at`, `razorpay_payment_id`, `razorpay_order_id` on `academies` table
- **Test mode active** — switch to live by swapping 2 env vars on Render

### 3. Sport Dashboard Blank Page Fix
- **Bug**: `useParams()` returned `sport` but component read `sportName`
- **Fix**: `const { sport: sportName } = useParams()` + added `academy_id` to API calls

### 4. Sport Dashboard Instant Load
- **Problem**: Page blocked until ALL AI calls finished (20+ seconds)
- **Fix**: Athletes render immediately, AI insights load one-by-one in background via `forEach(async ...)`

### 5. Parent WhatsApp Broadcast Reframed
- Changed from robotic AI text to coach-friendly message format
- Opens with "Hello from *Academy Name*", closes with "— Coach, Academy Name"
- Subtly markets AthleteIQ to parents

### 6. Top Loading Bar (NProgress)
- `nprogress` installed, `TopLoader.jsx` component created
- Added to Dashboard, AthleteProfile, SportDashboard, SessionPlannerPage

### 7. Skeleton Screens
- `LoadingSkeleton.jsx` expanded with types: `dashboard`, `profile`, `athlete-list`, `sport-dashboard`, `session-planner`
- Shimmer animation with gray gradient

### 8. Production-Ready Meta Changes
- `index.html`: Title → "AthleteIQ — Elite Performance Management", OG tags, mobile web app meta
- `manifest.json`: Name updated, theme/background color set to `#111827`
- `config.js`: Default API URL set to Render production URL
- `main.py` CORS: Added `athleteiq.in` and `www.athleteiq.in` origins

### 9. Memory Leak Fix (Earlier Session)
- `get_supabase()` was creating a new client per request
- Fixed to single module-level client across all route files
- `WEB_CONCURRENCY=1` set on Render

---

## Pricing Strategy (Locked)

| Tier | Price | Target | Notes |
|------|-------|--------|-------|
| **Founding 15** | ₹999/mo | First 15 academies | Full Pro access, price locked for life |
| **Pro** | ₹2,499/mo | 30-100 athletes, growing academies | Standard tier |
| **Elite** | ₹4,999/mo | Large clubs (PYC, Deccan Gymkhana) | Hand-sold, custom branding, monthly founder call |

> **Key sales framing**: "Less than ₹35 per athlete per month — less than one protein bar"

### No Athlete Caps
- Caps create doubt, slow the close, add backend complexity
- Groq/Supabase costs at this scale are negligible
- Caps are a Series A problem

---

## Infrastructure & Scaling Analysis

### At 15 Academies × 30 Athletes = 450 Athletes

| Service | Limit | Status | Upgrade Trigger |
|---------|-------|--------|----------------|
| Render Free | 512MB RAM, cold start | Mitigated with UptimeRobot | $7/mo at 5th paying academy |
| Supabase Free | 500MB DB, 2GB bandwidth | Safe until ~month 4-5 | $25/mo at month 5 |
| Vercel Free | 100GB bandwidth | Safe indefinitely | Never |
| Groq Free | 14,400 req/day | Using ~3% of limit | Never at this scale |

### Revenue Math
- 15 × ₹999 = **₹15,000/month** revenue
- Infrastructure: **₹0/month** (all free tiers)
- **100% margin** until Supabase hits storage limit

### Backend Optimization Strategies (Ranked)
1. ✅ UptimeRobot (done)
2. Stagger AI calls on dashboard load
3. Extend AI cache from 12h to 24h
4. Cloudflare Workers as free proxy/cache layer
5. Supabase Edge Functions for lightweight reads
6. Render Starter at $7/mo when needed

---

## Razorpay Setup Details

- **Account**: Registered as Individual/Sole Proprietor, Unregistered business
- **Category**: IT and Software → SaaS
- **KYC**: Instantly approved
- **Current mode**: Test
- **Test card that works**: `5267 3181 8797 5449` (CVV: 123, OTP: 1234)
- **Test UPI**: `success@razorpay`
- **Go-live process**: Swap `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on Render to live keys, add webhook under Live mode on Razorpay dashboard

---

## Key Backend Files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, CORS, all router imports |
| `routes/payments.py` | Razorpay order creation, verification, webhook |
| `routes/athletes.py` | Athlete CRUD |
| `routes/wellness.py` | Wellness check-ins |
| `routes/ai.py` | AI insights with 12h Supabase cache |
| `routes/attendance.py` | Attendance logging |
| `routes/injuries.py` | Injury tracking |
| `routes/reports.py` | Weekly AI reports, PDF generation |
| `routes/session_planner.py` | AI drill/session planning |
| `routes/auth.py` | Authentication |

## Key Frontend Files

| File | Purpose |
|------|---------|
| `src/pages/Dashboard.jsx` | Main coach dashboard |
| `src/pages/SportDashboard.jsx` | Sport-specific filtered view |
| `src/pages/AthleteProfile.jsx` | Individual athlete detail |
| `src/pages/AcademyProfile.jsx` | Academy settings + upgrade CTA |
| `src/pages/UpgradeModal.jsx` | Razorpay payment modal with plan details |
| `src/components/BulkLogModal.jsx` | 3-step session logging |
| `src/components/common/TopLoader.jsx` | NProgress loading bar |
| `src/components/common/LoadingSkeleton.jsx` | Skeleton screens |
| `src/utils/trialUtils.js` | Trial expiry check (`plan === 'paid'` bypasses) |
| `src/config.js` | API base URL |

---

## Supabase Tables

| Table | Key Columns |
|-------|-------------|
| `academies` | id, name, plan, paid_at, razorpay_payment_id, razorpay_order_id |
| `athletes` | name, sport, academy_id |
| `wellness_logs` | athlete check-in data |
| `session_logs` | bulk session data |
| `injury_logs` | injury tracking |
| `attendance_logs` | daily attendance |
| `weekly_reports` | AI-generated, locked after creation |
| `ai_insights_cache` | 12h cached AI insights |

---

## Next Priorities (In Order)

1. ~~Razorpay payment integration~~ ✅ Done
2. ~~Fix Sport Dashboard blank page~~ ✅ Done  
3. Buy `athleteiq.in` domain (next month)
4. First real academy demo in Pune
5. Get 5 paying Founding 15 academies
6. Logo finalization and branding
