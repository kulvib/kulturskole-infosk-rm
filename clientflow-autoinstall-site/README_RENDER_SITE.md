# ClientFlow Render install site

Denne mappe kan deployes direkte som Render Static Site.

## Struktur

```text
clientflow-autoinstall-site/
├── index.html
├── setup-clientflow-desktop-icon.sh
├── clientflow_desktop_installer_package.zip
├── clientflow_clean_ubuntu_installer_v2.zip
└── autoinstall.yaml
```

## Anbefalet flow

Installer Ubuntu manuelt. Efter login på den nye klient:

```bash
curl -fL https://autoinstall.onrender.com/setup-clientflow-desktop-icon.sh -o setup-clientflow-desktop-icon.sh
chmod +x setup-clientflow-desktop-icon.sh
bash setup-clientflow-desktop-icon.sh
```

Derefter dobbeltklik på skrivebordsikonet:

```text
ClientFlow Installer
```

Menuen giver:

```text
1) Installer ClientFlow på frisk Ubuntu
2) Installer client-secret efter godkendelse
3) Verificér installation
4) Vis logs/status
```

## Render settings

```text
Root Directory: clientflow-autoinstall-site
Build Command: blank
Publish Directory: .
```
