#!/usr/bin/env python3
"""Generate VAPID keys and update the feed's local .env without printing secrets."""

from __future__ import annotations

import base64
import pathlib

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

directory = pathlib.Path(__file__).parent
private_path = directory / "private_key.pem"
env_path = directory / ".env"

if private_path.exists():
    private_key = serialization.load_pem_private_key(
        private_path.read_bytes(), password=None
    )
else:
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_path.write_bytes(private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ))
    private_path.chmod(0o600)

public_bytes = private_key.public_key().public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint,
)
public_key = base64.urlsafe_b64encode(public_bytes).rstrip(b"=").decode()

managed = {
    "VAPID_SUBJECT": "mailto:admin@fwc2026live.com",
    "VAPID_PRIVATE_KEY": str(private_path),
    "VAPID_PUBLIC_KEY": public_key,
    "SUBSCRIPTIONS_DB": str(directory / "subscriptions.sqlite3"),
}
lines = env_path.read_text().splitlines() if env_path.exists() else []
kept = [
    line for line in lines
    if not any(line.startswith(f"{key}=") for key in managed)
]
env_path.write_text("\n".join(kept + [""] + [
    f"{key}={value}" for key, value in managed.items()
]) + "\n")
env_path.chmod(0o600)
print(public_key)
