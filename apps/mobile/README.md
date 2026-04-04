# Workived Mobile (Expo)

Native iOS and Android app for Workived HR platform.

## Tech Stack

- **Expo** ~52.0.0 (React Native)
- **React Navigation** v7 (Stack + Bottom Tabs)
- **React Query** (API state management)
- **Axios** (HTTP client)
- **TypeScript** (Type safety)

## Features

- 🏠 **Home Dashboard** — Clock in/out with real-time status
- 📅 **Leave Management** — Apply for leave, view balance
- ✅ **Approvals** — Review team requests
- 👤 **Profile** — User settings

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo Go app on your phone (for testing)

### Installation

```bash
cd apps/mobile
npm install
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
# 1. Install Expo Go from App Store/Play Store
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
├── App.tsx                 # Entry point
├── app.json                # Expo config
├── src/
│   ├── screens/            # Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── LeaveScreen.tsx
│   │   ├── ApprovalsScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── navigation/         # React Navigation setup
│   ├── api/                # API client
│   ├── types/              # TypeScript types
│   └── components/         # Reusable components (coming)
└── assets/                 # Images, fonts, icons
```

## Development Workflow

1. **Test with Expo Go** — Fast development on real devices
2. **Build for testing** — `npx expo build:android/ios`
3. **Production build** — Use EAS Build for app stores

## API Integration

Mobile app reuses existing backend endpoints:

- `GET /api/v1/mobile/home` — Aggregated home data
- `POST /api/v1/attendance/clock-in` — Clock in
- `POST /api/v1/attendance/clock-out` — Clock out

Authentication uses JWT tokens stored in `SecureStore`.

## Next Steps

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
