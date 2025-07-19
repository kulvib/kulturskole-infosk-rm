# Dashboard-frontend

Dette er et simpelt React-dashboard, der taler sammen med din FastAPI-backend (JWT auth, klientstyring, livestream, terminal mm).

### Features

- Login med JWT token (modtager fra backend)
- Forside: Liste over klienter (status, info-knap)
- Info-side: Klientoplysninger, redigerbart visningsnavn og webadresse, handlinger (start/stop/genstart/shutdown), browserstyring
- Live stream fra klient (MJPEG eller WebRTC)
- WebSocket terminal til klient

### Opsætning

1. Kopiér alle filer til et nyt GitHub repository.
2. Kør:
   ```bash
   npm install
   npm start
   ```
3. Tilret evt. `API_BASE` i `src/api/clientApi.js` så det peger på din backend (fx `https://dit-backend.onrender.com/api`).

### Backend krav

- FastAPI backend med JWT-token-auth (som beskrevet ovenfor)
- Klient-endpoints som matcher frontendens API-kald (se `src/api/clientApi.js`)

### Udvidelse

Du kan style videre i `src/styles.css` og tilføje flere features efter behov.
