# ClientFlow Render install site v6.5

Deployes som Render Static Site.

## Bootstrap på ny Ubuntu-klient

```bash
sudo apt-get update
sudo apt-get install -y curl unzip ca-certificates
curl -fL https://autoinstall.onrender.com/setup-clientflow-desktop-icon.sh -o setup-clientflow-desktop-icon.sh
chmod +x setup-clientflow-desktop-icon.sh
bash setup-clientflow-desktop-icon.sh
```

Derefter åbnes skrivebordsikonet `ClientFlow Installer`.

## Filer i publish-root

```text
index.html
README_RENDER_SITE.md
setup-clientflow-desktop-icon.sh
clientflow_desktop_installer_package.zip
clientflow_clean_ubuntu_installer_v6.zip
clientflow_clean_ubuntu_installer_v5.zip
clientflow_version.json
autoinstall.yaml
```

`clientflow_clean_ubuntu_installer_v5.zip` er alias til nyeste v6, så ældre launchere/self-update flows ikke knækker.

## v6.5

Tilføjer separat admin/root-terminal-agent. Remote desktop forbliver kiosk-sessionen.
