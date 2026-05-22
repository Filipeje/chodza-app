# Nahratie projektu na GitHub

## 1. Nainštalujte Git (ak ho ešte nemáte)

1. Stiahnite **Git for Windows**: https://git-scm.com/download/win  
2. Po inštalácii **zatvorte a znova otvorte** Cursor (alebo PowerShell).

Overenie:

```powershell
git --version
```

## 2. Vytvorte prázdne úložisko na GitHub

1. Prihláste sa na https://github.com  
2. **New repository**  
3. Názov napr. `chodza-app`  
4. Nechajte **prázdne** (bez README, bez .gitignore)  
5. **Create repository**

## 3. Nahrajte kód z počítača

V PowerShelli (cesta k vášmu projektu):

```powershell
cd "c:\Users\Synko\Documents\chodza-app"

git init
git add .
git commit -m "Prvý commit: prototyp Chôdza app"

git branch -M main
git remote add origin https://github.com/Filipeje/chodza-app.git
git push -u origin main
```

Repozitár: https://github.com/Filipeje/chodza-app

Pri prvom `git push` sa prihlásite (okno prehliadača alebo token).

## Rýchlejšie (skript)

Po inštalácii Gitu v tom istom priečinku:

```powershell
.\upload-to-github.ps1 -GitHubUser Filipeje -RepoName chodza-app
```

## Voliteľné: GitHub CLI

```powershell
winget install GitHub.cli
gh auth login
gh repo create chodza-app --public --source=. --push
```
