# Komplet installationsguide til Python-klient med venv og nohup på Ubuntu

Denne guide hjælper dig med at installere og køre dit API-klient-script på Ubuntu 24.04+, med brug af **venv** og **nohup** til baggrundskørsel.

---

## 1. Opdater system og installer Python, pip og venv

Åbn terminalen og kør:
```bash
sudo apt update
sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv -y
```

---

## 2. Opret projektmappe og gå ind i den

Eksempel:
```bash
cd ~
mkdir -p ~/api
cd ~/api
```

---

## 3. Opret og aktiver Python virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```
Du ser nu `(venv)` forrest i din prompt.

---

## 4. Opret requirements.txt

Hvis du kun skal bruge requests:
```bash
echo "requests" > requirements.txt
```

---

## 5. Installer dependencies i venv

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 6. Tilføj dit script

Opret fx `client_flow.py`:
```bash
nano client_flow.py
```
Indsæt dit script.  
Gem med CTRL+O, ENTER, afslut med CTRL+X.

---

## 7. Test at scriptet virker

Sørg for at venv er aktiveret:


## 8. Kør scriptet i baggrunden med nohup

```bash
source venv/bin/activate
nohup python3 client_flow.py > client_flow.log 2>&1 &
```

- Scriptet kører nu i baggrunden.
- Output gemmes i `client_flow.log`.

---

## 9. Luk terminalen

Du kan nu lukke terminalen eller logge ud – scriptet fortsætter med at køre.

---

## 10. Tjek output og status

Se loggen live:
```bash
tail -f client_flow.log
```

---

## 11. Stop scriptet (hvis nødvendigt)

Find process-ID:
```bash
ps aux | grep client_flow.py
```
Stop processen:
```bash
kill <PID>
```

---

## 12. Tilføj flere scripts

Du kan gentage ovenstående for flere scripts, fx `calendar_flow.py`, og starte dem med:
```bash
nohup python3 calendar_flow.py > calendar_flow.log 2>&1 &
```

---

## Fejlsøgning og tips

- Kør altid scripts som din normale bruger, ikke root.
- Installer kun systempakker med sudo.
- Du kan opdatere requirements.txt og køre `pip install -r requirements.txt` igen, hvis du får brug for flere Python-pakker.
- Lav backup af dine scripts jævnligt.

---

**Din Ubuntu er nu klar til at udvikle og køre Python-klienter til API'en, med venv og stabil baggrundskørsel via nohup!**
