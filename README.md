# Mammar (معمـار)

> **An AI-Powered Environmental Site Analysis Web Platform for Residential Plots in Riyadh.**

King Saud University · Department of Information Technology · IT496 Project

## 📖 About The Project
**Mammar** is a decision-support platform that automates and enhances the environmental and contextual analysis of residential land plots in Riyadh. It helps both architects and homeowners make informed, Saudi code compliant, and environmentally optimized design decisions before construction begins.

The system evaluates site conditions such as solar exposure, wind patterns, shading, noise, and surrounding urban density, and presents them in a results dashboard with design recommendations.

## 🚀 Core Features
*   **Role-Based Dashboards:** Interfaces tailored to **Homeowners** (simplified insights) and **Architects** (advanced indicators and in-depth explanations).
*   **Hybrid Analysis Engine:** Machine learning classifiers, a rule-based compliance layer for local building regulations, and physical and environmental calculations.
*   **Interactive Plot Selection:** Select a plot on an interactive map of Riyadh.
*   **History & Favorites:** Review past analyses, rename results, search, and keep favorites.
*   **Bilingual Interface:** Arabic (right-to-left) and English (left-to-right).

> The sections above describe the full platform. See **Project Status** for what this repository currently contains.

## 📌 Project Status

**Implemented in this repository (frontend)**
- Landing page, login, sign-up, and forgot-password screens
- Home screen and map-based plot selection (street and satellite views)
- Analysis flow and results dashboard: indicators, gauges and level meters, wind card, facade picker, site diagrams (sun and wind, roads, land use), neighbourhood information, regulatory constraints, and design decisions
- History and Saved pages, rename-result dialog, export dialog, profile page, and privacy policy
- Arabic and English interface with right-to-left support

**Not yet implemented**
- Backend, database, and real authentication. Login and sign-up currently accept any valid-looking input and do not create real accounts.
- Machine learning models and the rule-based compliance layer
- Real plot lookup and analysis results. The app currently uses **sample (mock) data** for plots, analysis results, neighbourhood information, and the signed-in user (see `frontend/lib/analysis.ts`, `analysis-detail.ts`, `neighbourhood.ts`, `results.tsx`, and `user.ts`). A badge in the interface marks mock data.

## 🛠️ Technology Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Maps | Leaflet, with OpenStreetMap and ArcGIS World Imagery tiles |
| Map data | OpenStreetMap (Overpass API) for roads and land use |

## ⚙️ Getting Started

All commands run from the `frontend` folder.

### Prerequisites
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 20.9 or later, with npm (required by Next.js 16)
- An internet connection (map tiles and map data are loaded online)

### 1. Clone the repository
```bash
git clone https://github.com/<owner>/<repository>.git
cd <repository>/frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Try the main flow
1. Open the landing page and go to **Sign up** or **Log in**. Use any valid-looking email and password, because authentication is not connected yet.
2. On the home screen, choose to analyze a new plot.
3. On the map, click a location to select a plot.
4. Start the analysis and wait for the results dashboard.
5. Open **History** or **Saved** from the header to see past results.

The interface starts in Arabic. Use the language switch in the header to change to English.

### Optional: analysis backend
Some diagrams (sun path, nearby places, and buildings) request data from a separate backend, which is **not part of this repository**. By default the app looks for it at `http://127.0.0.1:8000`. Without it, the app still runs, but the sun path diagram cannot load and the nearby places and buildings layers are left out. To point the app at a different backend, create `frontend/.env.local` with:
```
NEXT_PUBLIC_API_URL=https://your-backend-url
```

### Other commands
```bash
npm run build   # create a production build
npm start       # serve the production build
npm run lint    # check the code with ESLint
```

## 📁 Project Structure
```
<repository>/
├── README.md
└── frontend/
    ├── app/          # Pages: landing, (auth) login/sign-up, (app) home, select-plot, analyzing,
    │                 #   results, history, saved, profile, privacy policy
    ├── components/   # Shared UI, plus analysis/, diagrams/, landing/, and map/ components
    ├── lib/          # Translations, mock data layer, API client, and map helpers
    ├── public/       # Logo and static assets
    └── package.json
```

## 👥 Team
| Name | GitHub |
|---|---|
| `<Deema Alquwaei>` | [@username](https://github.com/username) |
| `<Renad Alqahtani>` | [@username](https://github.com/username) |
| `<Jana Aldakheel>` | [@username](https://github.com/username) |
| `<Linah Alsamari>` | [@lin-010](https://github.com/username) |

**Supervisor:** `<Dr. Naila Alhassoun>`

## 📄 License
Developed as an academic project at King Saud University. All rights reserved by the project team.
