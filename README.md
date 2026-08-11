# 🇵🇦 Panama Purchasing Pipeline Web Application

A modern, multi-user web application designed for the Panama purchasing team to manage detections, affaires, offers, statuses, and stalling alerts with real-time cloud synchronization.

---

## 🚀 Instant Local Preview (Zero Installation)

1. Simply double-click [`index.html`](index.html) in your browser.
2. Enter the default Team PIN: `0000`
3. All 89 existing Panama records are pre-loaded!

---

## ☁️ Step-by-Step Cloud Sharing Setup (100% Free)

To share this live with your colleague with real-time multi-user synchronization:

### Step 1: Create your Free Supabase Cloud Database (2 mins)
1. Go to [https://supabase.com](https://supabase.com) and click **Sign Up** (Free).
2. Click **New Project** $\rightarrow$ Name it `panama-pipeline` $\rightarrow$ Set a database password.
3. Once created, click on the **SQL Editor** tab on the left navigation bar.
4. Click **New Query**, open the file [`supabase_schema.sql`](supabase_schema.sql), copy everything, paste it into the editor, and click **Run**.
   - *This automatically creates the table and pre-loads all 89 Panama deals.*
5. Go to **Project Settings** (gear icon) $\rightarrow$ **API**:
   - Copy your **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - Copy your **anon public Key** (e.g. `eyJhbGciOi...`)

---

### Step 2: Deploy to Vercel (2 mins)
1. Go to [https://vercel.com](https://vercel.com) and sign up with your email or GitHub (Free).
2. Create a repository on [GitHub](https://github.com) (Private), drag-and-drop the files from this `panama_pipeline_app` folder, and commit.
3. In Vercel, click **Add New** $\rightarrow$ **Project** $\rightarrow$ select your GitHub repository $\rightarrow$ Click **Deploy**.
4. Vercel will instantly give you a live production link (e.g. `https://panama-pipeline.vercel.app`)!

---

### Step 3: Connect Cloud Database & Share
1. Open your live Vercel URL in Chrome or Edge.
2. Unlock with PIN `0000`.
3. Click the **Settings (⚙️)** button in the top right.
4. Paste your **Supabase Project URL** and **Anon API Key** $\rightarrow$ Click **Save & Connect Cloud**.
5. Send the URL and PIN to your colleague! Both of you are now connected to the same live database in real-time.

---

## ✨ Features Included
- 📊 **Executive Dashboard**: KPI Cards (Total Detections, Active Value, Forecast Value, Ordered Value, Stale Deals count), Buyer Funnel breakdown with Offer Signals (`🔮 Forecast`, `🟠 Recv`), and Category performance.
- 📋 **Interactive Kanban Board**: 6 visual stages with drag-and-drop support that automatically stamps dates and transitions deals.
- 📑 **Searchable Table Grid**: Sorting, status badges, and 1-click **Export to CSV / Excel**.
- ⏱️ **Automatic Stalling Triggers**: Live 5-day (Detection/Affaire) and 14-day (Offer stage) warning badges.
- 🔒 **PIN Security Layer**: Protects workspace from unauthorized access.
