# Kurzová tabuľa (MVP)

Digitálna kurzová tabuľa pre zmenárne – prvá funkčná verzia.

## Čo už funguje

1. **Registrácia / prihlásenie** (`index.html`)
2. **Admin** (`admin.html`)
   - hlavička (názov firmy)
   - zapnúť/vypnúť dátum a čas
   - pridávať / upravovať / odstraňovať meny
   - vlastný text dole na tabuli
   - link na displej
3. **Displej** (`display.html?board=slug`) – veľký kurzový lístok pre TV/monitor

## Spustenie

Otvorte priečinok cez lokálny server (odporúčané kvôli `localStorage` a linkom):

```bash
cd kurzova-tabula
npx --yes serve -l 5173
```

Potom:
- http://localhost:5173/ – registrácia
- po registrácii admin → **Otvoriť tabuľu**

Alebo otvorte `kurzova-tabula/index.html` priamo v prehliadači.

## Poznámka k dátam

MVP ukladá účet a tabuľu v **localStorage** tohto prehliadača (bez cloudu).
Na TV s iným zariadením zatiaľ neuvidíte dáta z PC – to príde s backendom (Supabase).

Pre demo na jednom PC: admin na jednom monitore, displej (ten istý link) na druhom.

## Ďalšie kroky

- cloud účet (multi-device / TV)
- kiosk režim (stabilný fullscreen)
- predplatné + super-admin
