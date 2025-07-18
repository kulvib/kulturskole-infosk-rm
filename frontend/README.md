# Infoskaerm Dashboard

Web-dashboard til Kulturskolens infoskærm, bygget i React (Vite).

## Opsætning

1. **Tilføj miljøvariabel i Vercel:**
   - Gå til projekt > Settings > Environment Variables
   - Key: `VITE_API_BASE`
   - Value: `https://kulturskole-infoskaerm-backend.onrender.com/api`

2. **Installer og start lokalt:**
   ```bash
   npm install
   npm run dev
   ```
   Dashboardet vil køre på [http://localhost:5173](http://localhost:5173)

3. **Deploy til Vercel for gratis hosting.**

## Funktioner

- JWT-login (admin/admin123)
- Klientoversigt (status, sidst set, web-url mm.)
- Info-side med redigering og handlinger
- Websocket-terminal og livestream

## Tilpasning

Udbyg gerne dashboardet med flere features – spørg hvis du vil have kodeeksempler!
