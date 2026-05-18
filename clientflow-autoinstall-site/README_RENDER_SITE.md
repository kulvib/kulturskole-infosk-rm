# ClientFlow Render install site v4.1

Denne mappe deployes som Render Static Site.

## Struktur

```text
clientflow-autoinstall-site/
├── index.html
├── setup-clientflow-desktop-icon.sh
├── clientflow_desktop_installer_package.zip
├── clientflow_clean_ubuntu_installer_v4.zip
└── autoinstall.yaml
```

## Anbefalet flow

Alle nye klienter installeres med enrollment/client-secret-flow.

1. Opret en installationskode i ClientFlow admin.
2. Installer Ubuntu manuelt.
3. Efter login på den nye klient:

```bash
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

Ubuntu on Xorg og automatisk login konfigureres automatisk under installation/geninstallation. Det vises ikke som separat menupunkt.

Den gamle manuelle client-secret-installation er fjernet.

## Render settings

```text
Root Directory: clientflow-autoinstall-site
Build Command: blank
Publish Directory: .
```
