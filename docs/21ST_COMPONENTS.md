# 21st.dev component research and attribution

Components were inspected on 2026-09-24 and adapted to the existing Vite/CSS architecture rather than forcing Tailwind/shadcn into the project.

1. **Crypto Dashboard** by reuno-ui — dashboard composition, animated metric cards. Source: https://21st.dev/@reuno-ui/components/crypto-dashboard — dependency: `framer-motion`.
2. **Wallet Card 2** by Berat Berkay Gökdemir — balance card and deposit actions. Source: https://21st.dev/@beratberkayg/components/wallet-card-2 — dependency: `lucide-react`.
3. **Asset Card** by Ravi Katiyar — responsive two-panel crypto asset card. Source: https://21st.dev/@ravikatiyar162/components/asset-card — dependency: `framer-motion`.
4. **Glass Real time crypto Chart** by Jessi — glass chart container treatment. Source: https://21st.dev/@moazamtrade/components/glass-real-time-crypto-chart — dependency: `recharts`.
5. **Hero Section** by reuno-ui — restrained animated grid hero composition. Source: https://21st.dev/@reuno-ui/components/hero-section.

No component that calls CoinGecko or another guessed third-party provider was copied as-is. Aeta preserves `NOT_CONFIGURED` in place of unverified market data. Adapted source lives in `frontend/src/components/FintechUI.tsx` and page-level compositions.
6. **Command Palette** by Özer / interior.dev (MIT) — keyboard navigation, fuzzy section search and animated overlay. Source: https://21st.dev/@ddoemonn/components/command-palette.
7. **Dismissible Alert Stack** by 7ovr — interactive notification stack and read state. Source: https://21st.dev/@7ovr/components/notifications-5.
8. **Statistics Card 7** by Sean Hello / ReUI (MIT) — grouped metric hierarchy and delta badges, adapted across user/admin stats. Source: https://21st.dev/@sean0205/components/statistics-card-7.
9. **Glowing Card** by Ravi Katiyar — restrained glass edge treatment adapted to featured financial surfaces. Source: https://21st.dev/@ravikatiyar162/components/glowing-card.
10. **Preloader** by shakeeb Islam — full-screen branded loading transition with Framer Motion. Source: https://21st.dev/@info-mdshakeeb/components/preloader.
11. **Three-Card Setup Steps** by 7ovr — adapted into the first-visit guided onboarding flow. Source: https://21st.dev/@7ovr/components/onboarding-setup-steps.
12. **Animated Menu Bar** by Ankit Verma — active expanding navigation behavior adapted into Aeta's mobile quick dock. Source: https://21st.dev/@itsankitverma/components/animated-menu-bar.
13. **AI Chat patterns** from 21st.dev AI Chat collection — adapted model selector, context attachments, conversation layout, animated thinking state and responsive composer for Aeta AI.
