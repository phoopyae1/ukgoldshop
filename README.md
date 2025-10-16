# UK Gold Shop Admin Portal

A lightweight web dashboard that helps a gold shop manage product listings and pawn transactions. The portal offers two dedicated workspaces:

- **Shop Admin** – upload gold product photos, capture price information and maintain an up-to-date inventory catalogue.
- **Pawn Data Admin** – capture pawn customer details, automatically calculate interest, and review daily and monthly performance insights.

## Getting started

1. Open the `public/index.html` file in a modern web browser (Chrome, Edge, Safari or Firefox).
2. Sign in with one of the built-in accounts:
   - **Shop Admin:** username `admin`, password `admin123`
   - **Pawn Data Admin:** username `dataman`, password `data123`
3. Begin managing gold items or pawn records from the relevant dashboard.

> **Note:** All information is saved in your browser's `localStorage` so the data stays on the device you use the portal from. Clear your browser data to reset the app.

## Features

### Shop Admin workspace
- Upload gold product photos (images smaller than 2 MB).
- Record product names and prices.
- View a tabular inventory with upload dates.

### Pawn Data Admin workspace
- Capture pawn transactions with customer name, principal amount, interest rate and term.
- Automatic monthly interest and total repayment calculation as you type.
- View all pawn records in a sortable table (latest first).
- Daily analysis card showing pawn count, principal and interest for the selected day.
- Monthly analysis card with totals filtered by the chosen calendar month.

## Development

This project is a static web application. You can customise styles or behaviour by editing the files in the `public/` directory:

- `index.html` – markup and layout
- `styles.css` – visual design
- `app.js` – interactivity and local data storage

You can serve the `public/` folder with any static web server if preferred (for example `npx serve public`).
