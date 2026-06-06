# PetID Partner Panel

Static web panel for business partners.

## What it does now

- Email/password login with Supabase Auth.
- Partner business profiles:
  - shop
  - clinic
  - hotel
  - taxi
  - grooming
- Business image upload to `business-assets`.
- Shop product CRUD with image upload, price, discount, stock, category and active flag.
- Service CRUD for clinics, hotels, taxis and grooming businesses.
- Shop order list and status updates.

## Required Supabase setup

Run:

```sql
supabase/migrations/20260605213000_partner_panel.sql
```

The migration creates:

- `business_profiles`
- `business_services`
- ownership RLS policies
- `business-assets` public storage bucket
- partner policies for `shop_products` and `shop_orders`
- extra columns on `shop_products` and `shop_orders`

## Local run

From the project root:

```powershell
python -m http.server 4174 --directory partner-panel
```

Open:

```text
http://127.0.0.1:4174
```

## Next app-side step

The mobile app still needs the next integration pass so:

- services from `business_services` appear in clinic/hotel/taxi/grooming detail pages;
- shop products can be linked to the selected shop/business instead of showing one global product list;
- admin can approve new partner businesses.
