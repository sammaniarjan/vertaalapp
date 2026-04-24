# Vertaalapp — Installatie-instructies

## Systeemvereisten

- Apple Silicon Mac (M1, M2, M3 of M4)
- macOS 13 Ventura of nieuwer
- Minimaal 8 GB RAM (16 GB aanbevolen)
- ~4 GB vrije schijfruimte (app + taalmodellen)

## Installatie

1. **Open het .dmg bestand** — dubbelklik op `Vertaalapp-1.0.0-arm64.dmg`
2. **Sleep Vertaalapp naar Applications** — gebruik de snelkoppeling in het DMG-venster
3. **Open Vertaalapp** — de eerste keer moet je Gatekeeper omzeilen (zie hieronder)

## Gatekeeper bypass (belangrijk!)

Omdat de app niet gesigneerd is met een Apple Developer certificaat, blokkeert macOS de app standaard. Dit is eenmalig:

### Methode 1: Rechts-klik (aanbevolen)
1. Open **Finder** → ga naar **Applications**
2. **Rechts-klik** (of Control-klik) op **Vertaalapp**
3. Kies **Open** in het menu
4. Klik op **Open** in het dialoogvenster
5. Vanaf nu opent de app normaal

### Methode 2: Terminal
```bash
xattr -cr /Applications/Vertaalapp.app
```
Open daarna Vertaalapp normaal.

## Eerste gebruik

Bij de eerste start:

1. **Backend laden** — de app toont een laadscherm terwijl de vertaalengine opstart (dit kan 10-30 seconden duren)
2. **Talen selecteren** — kies de talen die je nodig hebt (bijv. Nederlands ↔ Arabisch)
3. **Modellen downloaden** — de app downloadt de benodigde taalmodellen (~200-600 MB per taal). Dit gebeurt eenmalig.
4. **Klaar** — druk op de microfoonknop en begin te spreken

## Taalmodellen

De taalmodellen worden opgeslagen in:
```
~/Library/Caches/vertaalapp/
```

Bij het verwijderen van de app blijven deze bestaan. Om ze ook te verwijderen:
```bash
rm -rf ~/Library/Caches/vertaalapp
```

## Privacy

- Alle spraakherkenning en vertaling draait **volledig lokaal** op je Mac
- Er worden **geen gegevens naar internet verstuurd** (behalve bij het downloaden van taalmodellen)
- Er wordt **niets opgeslagen** — gesprekken verdwijnen bij het sluiten van de app

## Problemen oplossen

### App start niet
- Controleer of je een Apple Silicon Mac hebt: Apple menu →  Over deze Mac → Chip
- Controleer of je macOS 13 of nieuwer hebt
- Heb je de Gatekeeper bypass uitgevoerd? (zie hierboven)

### Vertaling is traag
- Sluit andere zware applicaties om RAM vrij te maken
- De eerste vertaling na het opstarten kan langzamer zijn (model wordt geladen)

### Modellen downloaden mislukt
- Controleer je internetverbinding
- Probeer het opnieuw — de download gaat verder waar hij gebleven was

## Contact

Vertaalapp is ontwikkeld door **Manava** (www.manava.nl).
