# UK Gold Shop Admin Portal

A dual-role admin portal built with React, TypeScript, Tailwind CSS, and Formik. It enables a gold shop to manage sales inventory and pawn transactions from purpose-built workspaces:

- **Shop Admin** – upload gold product photos, capture price information, and maintain an inventory catalogue.
- **Pawn Data Admin** – record pawn pledges, automatically calculate interest, and review daily or monthly performance insights.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   The app runs on <http://localhost:5173> by default.
3. Use one of the bundled accounts to sign in:
   - **Shop Admin:** username `admin`, password `admin123`
   - **Pawn Data Admin:** username `dataman`, password `data123`

> **Note:** All information is saved in your browser's `localStorage`, so the data stays on the device you use the portal from. Clear your browser data to reset the app.

## Available scripts

- `npm run dev` – launch Vite in development mode.
- `npm run build` – type-check and create an optimised production build.
- `npm run preview` – serve the production build locally.

## Key features

### Shop Admin workspace
- Upload gold product photos with an inline preview before saving.
- Capture product names and GBP prices using validated Formik forms.
- Review the inventory in a pageless, scrollable table with recent items first.

### Pawn Data Admin workspace
- Record pawn transactions with Formik + Yup validation and selectable interest rates.
- Automatic monthly interest and total repayment calculations as you update the form.
- Daily and monthly analytics cards with adjustable date/month filters.
- Full transaction history with currency and percentage formatting for quick audits.

## Tech stack

- **React 18 + TypeScript** for typed component logic.
- **Tailwind CSS** for utility-first styling.
- **Formik & Yup** for forms, validation, and calculated summaries.
- **Vite** for fast local development and builds.
