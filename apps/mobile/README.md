# Workived Mobile (Expo)

Native iOS and Android app for Workived HR platform.

## Tech Stack

- **Expo SDK** 54.0.0 (React Native 0.81.5)
- **React** 19.1.0
- **React Navigation** 7 (Stack + Bottom Tabs)
- **TanStack Query** (React Query) — API state management
- **Axios** — HTTP client with JWT auth
- **TypeScript** — Type safety
- **SecureStore** — Encrypted token storage

## Features

- 🔐 **Authentication** — Email/password login with JWT tokens
- 🏠 **Home Dashboard** — Clock in/out with real-time status
- 📅 **Leave Management** — Apply for leave, view balance (coming soon)
- ✅ **Approvals** — Review team requests (coming soon)
- 👤 **Profile** — User info and logout

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- **Expo Go app (SDK 54)** on your phone for testing

### Installation

```bash
cd apps/mobile
npm install --legacy-peer-deps
```

### Running

```bash
# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Test on physical device  
# 1. Install Expo Go (SDK 54) from App Store/Play Store
# 2. Scan QR code from terminal
```

## Configuration

Update API URL in `src/api/client.ts`:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://YOUR_LOCAL_IP:8080/api/v1'  // Replace with your IP
  : 'https://api.workived.com/api/v1'
```

**Note:** Use your local network IP (not `localhost`) when testing on physical devices.

## Project Structure

```
apps/mobile/
├── App.tsx                      # Entry point with providers
├── app.json                     # Expo config
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state management
│   ├── screens/
│   │   ├── HomeScreen.tsx       # ✅ Complete
│   │   ├── LoginScreen.tsx      # ✅ Complete  
│   │   ├── ProfileScreen.tsx    # ✅ Complete
│   │   ├── LeaveScreen.tsx      # Placeholder
│   │   └── ApprovalsScreen.tsx  # Placeholder
│   ├── navigation/              # React Navigation setup
│   │   └── index.tsx            # Auth gate + bottom tabs
│   ├── api/
│   │   └── client.ts            # Axios with JWT interceptors
│   ├── types/
│   │   └── api.ts               # TypeScript types (matches backend)
│   └── components/              # Reusable components (coming)
└── assets/                      # Images, fonts, icons
```

## Authentication Flow

1. User enters email/password in `LoginScreen`
2. `AuthContext.login()` calls `POST /api/v1/auth/login`
3. JWT tokens stored in `SecureStore` (encrypted)
4. Navigation automatically shows `MainTabs` when authenticated
5. Axios interceptor adds `Authorization: Bearer <token>` to all requests
6. On 401 response, tokens cleared and user redirected to login

## API Integration

Mobile app reuses existing backend endpoints:

- `POST /api/v1/auth/login` — Authentication
- `POST /api/v1/auth/logout` — Logout
- `GET /api/v1/mobile/home` — Aggregated home data (BFF)
- `POST /api/v1/attendance/clock-in` — Clock in
- `POST /api/v1/attendance/clock-out` — Clock out

## Testing

```bash
npm test                  # Run all tests
npm test -- --coverage    # With coverage report
```

Current test coverage: **98%+** (services, screens, contexts)

## Development Workflow

1. **Local development** — Use Expo Go for hot reload
2. **Testing** — Run Jest tests for new features
3. **Type safety** — TypeScript catches errors at compile time
4. **API alignment** — Types in `src/types/api.ts` match backend Go structs

## Next Steps

- [ ] Camera integration for photo verification (WOR-104)
- [ ] GPS location capture (WOR-118)
- [ ] Leave apply screen (WOR-111)
- [ ] Approvals inbox (WOR-116)
- [ ] Push notifications (WOR-113)
- [ ] Offline support (WOR-106)
- [ ] Performance optimization with Hermes (WOR-105)

- [ ] Implement login/authentication
- [ ] Add camera for photo verification
- [ ] Add GPS for location tracking
- [ ] Implement leave apply screen
- [ ] Implement approvals inbox
- [ ] Add push notifications
- [ ] Offline support with AsyncStorage

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Troubleshooting

**Metro bundler issues:**
```bash
npx expo start --clear
```

**Module resolution errors:**
```bash
rm -rf node_modules
npm install
```

**iOS simulator not opening:**
```bash
sudo xcode-select --switch /Applications/Xcode.app
```
