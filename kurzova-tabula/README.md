# Kurzová tabuľa

Digitálna kurzová tabuľa pre zmenárne.

## Čo funguje (MVP)

1. **Registrácia / prihlásenie** – `index.html`
2. **Admin** – `admin.html`
   - hlavička (názov firmy)
   - zapnúť / vypnúť dátum a čas
   - pridávať, upravovať a odstraňovať meny
   - vlastný text dole na tabuli
   - link na displej
3. **Displej** – `display.html?board=slug` (TV / monitor)

## Spustenie

```bash
npx --yes serve -l 5173
```

Otvor http://localhost:5173/ → registrácia → admin → **Otvoriť tabuľu**.

## Dáta

MVP ukladá účet a tabuľu v **localStorage** tohto prehliadača (bez cloudu).
Cloud / multi-device (TV + mobil) príde neskôr.

## Štruktúra

```
index.html      – registrácia a prihlásenie
admin.html      – nastavenie tabule
display.html    – kurzový lístok
css/            – štýly
js/             – logika + localStorage
```
