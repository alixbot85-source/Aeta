# Aeta Android App

Aeta Android is generated with Capacitor and packages the existing React/Vite frontend as a native Android project.

## What is included

- Native Android project: `frontend/android`
- Capacitor config: `frontend/capacitor.config.ts`
- Package id: `com.aeta.fintech`
- App name: `Aeta`
- RTL support through the generated Android manifest
- Web assets copied from `frontend/dist`
- Fullstack API support through `VITE_API_URL`

## Build and sync web assets

```bash
npm run android:sync
```

This runs the frontend build and then `cap sync android`.

## Open in Android Studio

```bash
npm run android:open
```

## Build debug APK

A local JDK and Android SDK are required:

```bash
npm run android:build
```

The Arena sandbox currently has no Java runtime installed, so Gradle compilation cannot complete here until `JAVA_HOME` points to a JDK.

## Fullstack/mobile configuration

For a real Android/fullstack build, never point the app to `localhost` unless the backend is inside the emulator/device. Use an HTTPS backend URL:

```env
VITE_API_URL=https://api.example.com
APP_ORIGINS=https://localhost,capacitor://localhost,https://your-web-origin.example.com
CROSS_SITE_COOKIES=true
```

Secrets, database credentials, blockchain private keys, AI provider keys and custody credentials must remain backend-only and must not be added to the Android project or Vite environment.

## Current production integrations

- TRON blockchain monitor: `NOT_CONFIGURED`
- Withdrawal broadcaster/custody: `NOT_CONFIGURED`
- PostgreSQL runtime adapter: `NOT_CONFIGURED`
- Real market data provider: `NOT_CONFIGURED`
- Exchange execution engine: `NOT_CONFIGURED`
- Hosted G4F/OpenAI-compatible AI endpoint: optional and externally hosted
