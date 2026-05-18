# ClientFlow Render install site v5.4

Denne mappe deployes som Render Static Site.

## Struktur

```text
clientflow-autoinstall-site/
├── index.html
├── setup-clientflow-desktop-icon.sh
├── clientflow_desktop_installer_package.zip
├── clientflow_clean_ubuntu_installer_v5.zip
└── autoinstall.yaml
```

## Anbefalet flow

Alle nye klienter installeres med enrollment/client-secret-flow.

1. Opret en installationskode i ClientFlow admin.
2. Installer Ubuntu manuelt.
3. Efter login på den nye klient:

```bash
sudo apt-get update
sudo apt-get install -y curl unzip ca-certificates
curl -fL https://autoinstall.onrender.com/setup-clientflow-desktop-icon.sh -o setup-clientflow-desktop-icon.sh
chmod +x setup-clientflow-desktop-icon.sh
bash setup-clientflow-desktop-icon.sh
```

4. Dobbeltklik på skrivebordsikonet `ClientFlow Installer`.
5. Vælg `Installer ClientFlow med installationskode`.
6. Indtast installationskoden.
7. Genstart maskinen, når installeren beder om det.
8. Godkend klienten i backend, hvis den står som pending.

Menuen giver:

```text
1) Installer ClientFlow med installationskode
2) Indtast ny installationskode / re-registrer klient
3) Geninstaller/opdater ClientFlow
4) Verificér installation
5) Vis logs/status
0) Afslut
```

Ubuntu on Xorg og automatisk login sættes automatisk under installation/geninstallation. Det vises ikke som separat menupunkt.

Den gamle manuelle client-secret-installation er fjernet.

## Driftshærdning

Installationen kører automatisk Ubuntu/app-opdatering, Xorg/autologin og kiosk-hardening. Teknikeren skal ikke vælge det som separat menupunkt.

Desktop-installeren viser enkle trin under installationen, fx opdatering, hjælpefunktioner, kiosktilstand, backend-registrering og service-start. Tekniske detaljer skrives fortsat i installationsloggen.

## Render settings

```text
Root Directory: clientflow-autoinstall-site
Build Command: blank
Publish Directory: .
```

## GUI-status

GUI viser Klient ID, Lokation og Backend-status. Ved Pending vises at klienten venter på godkendelse. Ved Approved + Kalender Off vises at klienten er online og venter på aktiv visningstid.

## v5.4

GUI Netværksinfo viser aktiv forbindelse/interface/IP/MAC. Kalenderoversigten viser 5 dage frem.


## v5.4

Status-feltet i GUI vises nu som én linje. Kiosk browser status er uændret.
