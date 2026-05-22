# Chôdza – športová aplikácia (prototyp)

Postup podľa vášho plánu:

| Krok | Stav | Čo je v projekte |
|------|------|------------------|
| 1. Dizajn na webe | ✅ | `index.html`, `styles.css`, `app.js` – mobilné UI |
| 2. Zdravie / GPS | ⏳ | Tlačidlo „Aktualizovať km“ je demo; HealthKit / Health Connect pripojíme ako native alebo Capacitor |
| 3. Supabase | 📄 | `supabase/schema.sql` |
| 4. Stripe | ⏳ | Placeholder v Profile |
| 5. Žrebovanie | 📄 | `utils/drawBasket.ts`, `scripts/draw-core.js`, `scripts/monthly-draw.cjs` |
| Admin panel | ✅ | `admin.html` – mesačný kôš, používatelia, uzatvorenie mesiaca (mock → Supabase) |

## Admin panel

Otvorte [`admin.html`](admin.html) (odporúčané cez lokálny server kvôli `localStorage`).

- **Mesačné nastavenia** – fond výhier v €, km na 1 bod, max bodov/deň
- **Používatelia** – tabuľka, vyhľadávanie, detail s dennou aktivitou
- **Uzatvorenie mesiaca** – žrebovanie 3 + 97, pity timer (1.5^streak), sync do aplikácie

Simulácia pity timera: `npm run draw:sim` (vyžaduje Node + `npx tsx`) alebo `node scripts/monthly-draw.cjs --pool=2500`

## Spustenie prototypu

1. Otvorte `index.html` v prehliadači (dvojklik alebo Live Server vo VS Code).
2. Na mobile: v Chrome → DevTools → zariadenie, alebo nahrajte na statický hosting.
3. PWA: z Chrome menu „Pridať na plochu“ (vyžaduje HTTPS alebo localhost).

## Ďalší krok (odporúčané)

1. Nainštalujte Node.js → `npm create vite` alebo Capacitor pre Health Connect / HealthKit.
2. Vytvorte projekt na [supabase.com](https://supabase.com), spustite `schema.sql`.
3. Stripe webhook → Edge Function → `users.status_predplatneho = 'premium'`.
