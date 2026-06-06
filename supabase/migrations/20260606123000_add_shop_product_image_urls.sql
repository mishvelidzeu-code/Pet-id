alter table public.shop_products
add column if not exists image_urls jsonb not null default '[]'::jsonb;

update public.shop_products
set image_urls = jsonb_build_array(image_url)
where image_url is not null
  and image_url <> ''
  and jsonb_array_length(image_urls) = 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shop_products_image_urls_max_3'
  ) then
    alter table public.shop_products
    add constraint shop_products_image_urls_max_3
    check (
      jsonb_typeof(image_urls) = 'array'
      and jsonb_array_length(image_urls) <= 3
    );
  end if;
end $$;
