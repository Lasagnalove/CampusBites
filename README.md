# CampusBites

CampusBites is an Expo React Native prototype for a CSUEB Hayward Hills campus-only food sharing feed. It ships with an in-memory realtime demo mode, and it switches to Supabase realtime when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are present.

## Run

```bash
npm install
npm run ios
npm run android
npm run web
```

Use a `@horizon.csueastbay.edu` email on the login screen. The mock Duo screen displays an optional passcode, or you can approve the simulated push directly.

CSUEB anchors in the prototype:

- `SF`: Student & Faculty Support
- `CB`: CORE Library, the Main Student Hot Spot
- `UU-S`: University Union South and Pioneers for HOPE Food Pantry
- `VBT`: Valley Business & Tech, the CS and Business Hub
- `MI`: Meiklejohn Hall
- `DC`: Dining Commons

Users can choose either a Student role or a Catering role. Catering users represent Pioneer Kitchen staff and post `Catering Clear-out` alerts with a 15-minute countdown.

## Native Services

- Mapbox GL JS powers the web campus map; set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to load `mapbox://styles/mapbox/dark-v11`.
- Google Maps is wired through `react-native-maps` for native builds; set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` before building native apps.
- Photo upload uses `expo-image-picker`.
- Nearby alerts use `expo-notifications` and fire for drops within 0.5 miles of the selected primary building.
- Supabase schema and RPCs live in `supabase/schema.sql`.
- The push notification edge-function sketch lives in `supabase/functions/notify-nearby-food-drop/index.ts`.

## Supabase Setup

1. Create a Supabase project and run `supabase/schema.sql`.
2. Copy `.env.example` to `.env` and fill in the public URL and anon key.
3. Restart Expo so the `EXPO_PUBLIC_*` values are bundled.

Without those env vars, the app still demonstrates realtime behavior locally: claiming decrements servings, "It's Gone!" turns a pin grey, and expired posts disappear automatically.
