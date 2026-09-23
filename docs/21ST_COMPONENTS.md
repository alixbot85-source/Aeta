# 21st.dev component research and attribution

Components were inspected on 2026-09-24 and adapted to the existing Vite/CSS architecture rather than forcing Tailwind/shadcn into the project.

1. **Crypto Dashboard** by reuno-ui — dashboard composition, animated metric cards. Source: https://21st.dev/@reuno-ui/components/crypto-dashboard — dependency: `framer-motion`.
2. **Wallet Card 2** by Berat Berkay Gökdemir — balance card and deposit actions. Source: https://21st.dev/@beratberkayg/components/wallet-card-2 — dependency: `lucide-react`.
3. **Asset Card** by Ravi Katiyar — responsive two-panel crypto asset card. Source: https://21st.dev/@ravikatiyar162/components/asset-card — dependency: `framer-motion`.
4. **Glass Real time crypto Chart** by Jessi — glass chart container treatment. Source: https://21st.dev/@moazamtrade/components/glass-real-time-crypto-chart — dependency: `recharts`.
5. **Hero Section** by reuno-ui — restrained animated grid hero composition. Source: https://21st.dev/@reuno-ui/components/hero-section.

No component that calls CoinGecko or another guessed third-party provider was copied as-is. Aeta preserves `NOT_CONFIGURED` in place of unverified market data. Adapted source lives in `frontend/src/components/FintechUI.tsx` and page-level compositions.
