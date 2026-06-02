# Push Notifications

ეს პროექტი უკვე გამზადებულია:

- მოწყობილობაზე `ExpoPushToken`-ის მისაღებად
- Supabase-ში `push_tokens` ცხრილში შესანახად
- ადმინ პანელიდან push გაგზავნისთვის
- Supabase Edge Function-ით Expo Push API-ზე გასაშვებად

## 1. რაც უკვე უნდა იყოს გაკეთებული

- Supabase SQL გაშვებულია
- `eas credentials -p ios`-ში Push Key მიბმულია

## 2. Edge Function deploy

თუ `supabase` CLI არ გაქვს:

```bash
npm install -g supabase
```

შემდეგ:

```bash
supabase login
supabase link --project-ref qclzhlftlkjhgmuqrawk
supabase functions deploy send-push-notification
```

## 3. ახალი iOS build

რადგან push token registration ახლა დაემატა კოდში, საჭიროა ახალი build:

```bash
eas build --platform ios --profile production
```

შემდეგ ეს build გაუშვი TestFlight-ში.

## 4. რეალური ტესტი iPhone-ზე

1. დააყენე ახალი TestFlight build
2. გახსენი აპი
3. დააჭირე notification permission-ზე `Allow`
4. შედი account-ით
5. Supabase-ში გადაამოწმე რომ `push_tokens` table-ში დაემატა ახალი token

## 5. გაგზავნა ადმინიდან

ახალ build-ში ადმინ პანელში გამოჩნდება `ნოთიფიკაციები` tab.

იქიდან:

- ჩაწერე `სათაური`
- ჩაწერე `ტექსტი`
- აირჩიე `ყველას` ან `ერთ მომხმარებელს`
- სურვილისამებრ აირჩიე სად გადავიდეს აპი დაჭერისას
- დააჭირე `გაგზავნა`

## 6. მნიშვნელოვანი შენიშვნა

ძველი უკვე დაყენებული TestFlight/App Store build push-ს ვერ მიიღებს, თუ ეს კოდი იმ binary-ში ჯერ არ იდო.

ანუ პირველად აუცილებლად საჭიროა ახალი iOS build.
