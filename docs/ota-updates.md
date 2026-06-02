# OTA Updates

ეს პროექტი უკვე გამზადებულია `EAS Update`-ისთვის.

## რას ნიშნავს პრაქტიკაში

- თუ შეცვლი მხოლოდ JavaScript-ს, დიზაინს, ტექსტებს, სურათებს ან Supabase ლოგიკას, ახალი store build აღარ დაგჭირდება.
- ასეთ დროს შეგიძლია გაუშვა:

```bash
npm run update:production -- --message "Quick fix"
```

- თუ ცვლი native ნაწილს, მაგალითად:
  - ახალ Expo/React Native native პაკეტს ამატებ
  - permission-ებს ცვლი
  - `app.json`-ში native config-ს ცვლი
  - `ios` / `android` build settings იცვლება

მაშინ ახალი store build ისევ დაგჭირდება.

## პირველი ჩართვა

იმიტომ რომ `expo-updates` ახლა პირველად ჩაირთო, საჭიროა ერთი ახალი production build:

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

სწორედ ამ build-იდან დაიწყებენ მომხმარებლები OTA update-ების მიღებას.

## publish workflow

ტესტი:

```bash
npm run update:preview -- --message "Preview update"
```

პროდუქცია:

```bash
npm run update:production -- --message "Production update"
```

## მნიშვნელოვანი წესი

`app.json`-ში `runtimeVersion.policy` დგას `appVersion`-ზე. ამიტომ როცა native ცვლილებას გააკეთებ და ახალი store build დაგჭირდება, მანამდე გაზარდე:

- `expo.version`
- `ios.buildNumber`
- `android.versionCode`

შემდეგ გაუშვი ახალი build.
