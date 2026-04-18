# Slyzah Agent Context & Instruction Manual

## Project Overview
Slyzah is a high-growth South African service marketplace. It connects consumers with verified professionals via a tiered subscription model.

## Ecosystem Components
1. **Slyzah-Web:** The SEO-facing marketplace and internal admin console.
2. **Slyzah-App:** The mobile entry point for customers to request quotes and chat with pros.
3. **Slyzah-Pro:** The business-management tool for vendors to manage leads, subscriptions, and verification.

## Core Business Logic to Maintain
- **Subscriptions:** Tiers include Basic, One Region, Three Regions, Provincial, and Multi-Province.
- **Verification:** The "Verified Pro Badge" is critical. It requires CIPC validation and OCR scanning of trade certificates.
- **Real-time Flow:** Leads must trigger push notifications to Pro users and real-time dashboard updates via Firestore `onSnapshot`.

## UI/UX Standards
- **Theme:** Always use `navy-900` for reliability and `gold-500` for premium/verified status.
- **Density:** The internal "Slyzah Mail" (Outlook clone) must maintain high information density.
- **Responsiveness:** Web must be optimized for Vercel Edge; Apps must respect device notches/safe areas.

## Migration Note for Antigravity
When assisting with code, the agent should prioritize cross-platform consistency. If a change is made to the `leads` data structure in the Web Admin, the agent must check the corresponding logic in the React Native `Slyzah-Pro` and `Slyzah-App` folders.