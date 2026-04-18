# Slyzah Ecosystem: Technical Stack

## 1. Universal Foundations
- **Primary Language:** TypeScript (Type safety across all platforms)
- **Design Language:** Corporate Navy (#001C3D) and Polished Gold (#D4AF37)
- **Backend-as-a-Service:** Google Firebase (Auth, Firestore, Storage)

## 2. Platform-Specific Frameworks
### Slyzah-Web (Marketplace & Admin)
- **Framework:** Next.js (App Router)
- **Rendering:** SSR for SEO (Landing pages), CSR for Admin dashboards
- **Styling:** Tailwind CSS + Framer Motion
- **Hosting:** Vercel

### Slyzah-App (Consumer) & Slyzah-Pro (Business)
- **Framework:** React Native via Expo SDK
- **Routing:** Expo Router (File-based)
- **Navigation:** React Native Safe Area Context + Gesture Handler
- **Build Tooling:** EAS (Expo Application Services)

## 3. Database & Storage (Firebase)
- **Cloud Firestore:** NoSQL real-time collections:
  - `users`: Client/Staff profiles
  - `professionals`: Vendor profiles & verification status
  - `leads`: Quote requests and service matching
  - `chats`: Real-time messaging
- **Firebase Storage:** Logic for logos, certificates (CIPC), and job photos.
- **Firebase Extensions:** Trigger Email (Brevo/Gmail integration).

## 4. Specialized Integrations
- **Payments:** PayFast (ZAR subscriptions & recurring billing)
- **Geolocation:** Google Maps Platform (Places API, Reverse Geocoding)
- **Notifications:** Expo Push Notifications + Firebase Cloud Messaging (FCM)
- **Verification:** Custom OCR logic (CIPC document scanning) & CIPC API client.
- **Communication:** Resend API (Transactional emails) & React Toastify.