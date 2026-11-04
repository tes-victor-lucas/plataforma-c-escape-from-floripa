"""Monta o script que instala o servidor multiplayer na instância EC2."""
from pathlib import Path

NODE_VERSION = "v22.23.4"
NODE_ARM64_SHA256 = "f7a1e486dbc8b286847815b477d4fb5e9fb963ed4489c3e1588853d685f589f9"
SERVER_PORT = 8080
# Limite da AWS para user data.
MAX_USER_DATA_BYTES = 16 * 1024


def server_files(server_dir: Path) -> list[Path]:
    return sorted([
        *server_dir.glob("src/**/*.js"),
        server_dir / "package.json",
        server_dir / "package-lock.json",
    ])


def build_user_data(server_dir: Path, allowed_origin: str) -> str:
    """O código vai no próprio script: mudar o servidor recria a instância no `pulumi up`."""
    tarball = f"node-{NODE_VERSION}-linux-arm64.tar.gz"
    files = "\n".join(
        f"mkdir -p \"$(dirname '{file.relative_to(server_dir)}')\"\n"
        f"cat > '{file.relative_to(server_dir)}' <<'ESCAPE_FILE_EOF'\n{file.read_text(encoding='utf-8')}\nESCAPE_FILE_EOF"
        for file in server_files(server_dir)
    )
    script = f"""#!/bin/bash
set -euo pipefail

cd /tmp
curl -fsSLO "https://nodejs.org/dist/{NODE_VERSION}/{tarball}"
echo "{NODE_ARM64_SHA256}  {tarball}" | sha256sum -c -
mkdir -p /opt/node
tar -xzf "{tarball}" -C /opt/node --strip-components=1
rm "{tarball}"

mkdir -p /opt/escape-server
cd /opt/escape-server
{files}
PATH=/opt/node/bin:$PATH npm ci --omit=dev

cat > /etc/systemd/system/escape-multiplayer.service <<'ESCAPE_UNIT_EOF'
[Unit]
Description=Servidor multiplayer do Escape from Floripa
After=network-online.target
Wants=network-online.target

[Service]
Environment=PORT={SERVER_PORT}
Environment=ALLOWED_ORIGIN={allowed_origin}
WorkingDirectory=/opt/escape-server
ExecStart=/opt/node/bin/node src/index.js
Restart=always
RestartSec=2
DynamicUser=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes

[Install]
WantedBy=multi-user.target
ESCAPE_UNIT_EOF
systemctl daemon-reload
systemctl enable --now escape-multiplayer
"""
    size = len(script.encode("utf-8"))
    if size > MAX_USER_DATA_BYTES:
        raise ValueError(f"User data com {size} bytes passa do limite de {MAX_USER_DATA_BYTES}.")
    return script
