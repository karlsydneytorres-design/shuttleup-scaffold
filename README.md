# ShuttleUp — Badminton Community App

## Tech stack
- **Mobile**: React Native + Expo (TypeScript)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **State**: Zustand (auth), TanStack Query (server state)
- **Navigation**: Expo Router (file-based)

## Getting started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Fill in your Supabase URL, anon key, and Google Maps API key
```

### 3. Set up Supabase
- Create a project at https://supabase.com
- Run the SQL migrations in /supabase/migrations (see Database Schema section)
- Generate types: `npx supabase gen types typescript --project-id YOUR_ID > src/types/database.ts`

### 4. Start the app
```bash
npm start
# Press i for iOS simulator, a for Android emulator
```

## Folder structure
```
src/
  lib/          # Supabase client, React Query client
  types/        # TypeScript types and DB types
  store/        # Zustand stores (auth, etc.)
  hooks/        # TanStack Query hooks per feature
  screens/      # Screen components grouped by feature
  components/   # Reusable UI components
  navigation/   # Tab and stack layout
  utils/        # Helper functions
```

## Build & deploy
```bash
npm install -g eas-cli
eas build --platform all
eas submit
```
