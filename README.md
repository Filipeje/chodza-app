# Chôdza – športová aplikácia (prototyp)

Postup podľa vášho plánu:

| Krok | Stav | Čo je v projekte |
|------|------|------------------|
| 1. Dizajn na webe | ✅ | `index.html`, `styles.css`, `app.js` – mobilné UI |
| 2. Zdravie / GPS | ⏳ | Tlačidlo „Aktualizovať km“ je demo; HealthKit / Health Connect pripojíme ako native alebo Capacitor |
| 3. Supabase | 📄 | `supabase/schema.sql` |
| 4. Stripe | ⏳ | Placeholder v Profile |
| 5. Žrebovanie | 📄 | `scripts/monthly-draw.js` |

## Spustenie prototypu

1. Otvorte `index.html` v prehliadači (dvojklik alebo Live Server vo VS Code).
2. Na mobile: v Chrome → DevTools → zariadenie, alebo nahrajte na statický hosting.
3. PWA: z Chrome menu „Pridať na plochu“ (vyžaduje HTTPS alebo localhost).

## Ďalší krok (odporúčané)

1. Nainštalujte Node.js → `npm create vite` alebo Capacitor pre Health Connect / HealthKit.
2. Vytvorte projekt na [supabase.com](https://supabase.com), spustite `schema.sql`.
3. Stripe webhook → Edge Function → `users.status_predplatneho = 'premium'`.
