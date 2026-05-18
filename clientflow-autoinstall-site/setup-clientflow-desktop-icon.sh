#!/usr/bin/env bash
set -euo pipefail

URL="https://autoinstall.onrender.com/clientflow_desktop_installer_package.zip"
WORK="$HOME/Hentet/clientflow-desktop-icon"

mkdir -p "$WORK"

sudo apt-get update || true
sudo apt-get install -y curl unzip ca-certificates || true

curl -fL "$URL" -o "$WORK/clientflow_desktop_installer_package.zip"
rm -rf "$WORK/unpacked"
mkdir -p "$WORK/unpacked"
unzip -o "$WORK/clientflow_desktop_installer_package.zip" -d "$WORK/unpacked"

cd "$WORK/unpacked/clientflow_desktop_installer_package"
bash setup_clientflow_desktop_icon.sh
