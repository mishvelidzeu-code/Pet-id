# Shop Order Push Notifications

მაღაზიიდან ახალი შეკვეთის გაკეთებისას `create-shop-order` Edge Function:

1. ინახავს შეკვეთას `shop_orders` ცხრილში
2. პოულობს ადმინის აქტიურ `push_tokens`
3. აგზავნის push notification-ს Expo Push API-ით

## რა არის საჭირო

1. ადმინის account-ით შეხვიდე აპში
2. ნოტიფიკაციებზე მისცე `Allow`
3. დარწმუნდე, რომ `push_tokens` ცხრილში შენი მოწყობილობა ჩანს

## Deploy

```bash
supabase login
supabase link --project-ref qclzhlftlkjhgmuqrawk
supabase functions deploy create-shop-order
```

## ტესტი

1. მომხმარებლის account-ით გააგზავნე შეკვეთა მაღაზიიდან
2. ადმინის ტელეფონზე უნდა მოვიდეს push:
   `ახალი შეკვეთა`
3. ნოტიფიკაციაზე დაჭერისას აპი გაგხსნის `Admin` tab-ზე

## შენიშვნა

თუ push არ მოვიდა, ჯერ გადაამოწმე:

- `push_tokens` table
- ადმინის account ნამდვილად admin-ად არის თუ არა
- TestFlight/App Store build ახალია თუ არა და აქვს თუ არა push registration კოდი
