-- Round #18: update the global supplier green-leaf reference rates.
-- These are indicative Sri Lankan reference rates. The final factory payment
-- continues to be confirmed monthly under the Tea Board reasonable-price formula.

begin;

insert into public.daily_tea_prices (price_date, grade, price_per_kg, factory_id)
values
  ((now() at time zone 'Asia/Colombo')::date, 'Standard', 176, null),
  ((now() at time zone 'Asia/Colombo')::date, 'Super', 186, null),
  ((now() at time zone 'Asia/Colombo')::date, 'PV Super', 204, null)
on conflict (price_date, grade) where factory_id is null
do update set price_per_kg = excluded.price_per_kg;

commit;
