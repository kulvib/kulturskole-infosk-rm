# ClientFlow Render install site

Denne mappe kan deployes direkte som Render Static Site.

## Struktur

```text
clientflow-autoinstall-site/
├── index.html
├── setup-clientflow-desktop-icon.sh
├── clientflow_desktop_installer_package.zip
├── clientflow_clean_ubuntu_installer_v3.zip
└── autoinstall.yaml
```

## Anbefalet flow

Alle nye klienter installeres nu med enrollment/client-secret-flow.

1. Opret en installationskode i ClientFlow admin.
2. Installer Ubuntu manuelt.
3. Efter login på den nye klient:

```bash
curl -fL https://autoinstall.onrender.com/setup-clientflow-desktop-icon.sh -o setup-clientflow-desktop-icon.sh
chmod +x setup-clientflow-desktop-icon.sh
bash setup-clientflow-desktop-icon.sh
```

4. Dobbeltklik på skrivebordsikonet:

```text
ClientFlow Installer
```

Menuen giver:

```text
1) Installer ClientFlow med installationskode
2) Verificér installation
3) Vis logs/status
```

Den gamle manuelle `Installer client-secret efter godkendelse`-mulighed er fjernet.

## Render settings

```text
Root Directory: clientflow-autoinstall-site
Build Command: blank
Publish Directory: .
```
