# ENSAT | Enterprise Asset Tracker

**ENSAT** is a lightweight, browser-based asset management system designed with the **ENSafrica** corporate identity. It provides a complete solution for tracking IT assets, managing stock, and handling employee issuance workflows without requiring a complex backend server.

## 🚀 Features

* **Dashboard Overview:** Real-time statistics on total assets, stock levels, and recent activity logs.
* **Inventory Database:**
    * **Smart Sorting:** Sort by Asset Tag, Date, or Status with one click.
    * **Live Search:** Debounced search for instant filtering of assets, users, or models.
    * **QR Code Generation:** Instantly generate QR codes for asset tagging.
* **Digital Workflows:**
    * **Issuance:** Step-by-step wizard for new starters with **Digital Signature** capture and **PDF Generation**.
    * **Movement:** Transfer custody of assets between employees.
    * **Retrieval:** Process returned assets and record damage assessments.
* **Data Management:**
    * **CSV Import/Export:** Bulk upload assets or export reports to Excel.
    * **Full Backup:** Save the entire database state to a JSON file and restore it later.
* **UI/UX:**
    * **ENS Branding:** High-contrast Black (#111) and Vivid Yellow (#FFD200) design.
    * **Dark Mode:** Native "True Black" dark mode for reduced eye strain and battery saving.
    * **Responsive:** Fully functional on desktop, tablet, and mobile devices.

## 🛠️ Technology Stack

* **Frontend:** HTML5, CSS3 (CSS Variables for theming), JavaScript (ES6+).
* **Storage:** `LocalStorage` (Data persists in the browser cache).
* **Dependencies (via CDN):**
    * *Chart.js* (Dashboard Analytics)
    * *html2pdf.js* (PDF Generation)
    * *PapaParse* (CSV Parsing)
    * *QRCode.js* (QR Code Generation)
    * *FontAwesome* (Icons)

## 📂 File Structure

```text
/ensat-project
│
├── index.html      # Main application structure and external library links
├── style.css       # ENS Corporate styling, dark mode, and responsive layout
├── script.js       # Business logic, workflow handling, and data persistence
└── README.md       # Documentation
