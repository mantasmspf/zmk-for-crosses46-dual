#!/usr/bin/env bash
# Builds the Neon Runner APK using Debian-packaged legacy Android tools
# (aapt/zipalign/apksigner/smali) instead of the full Android Gradle
# toolchain, since this environment's network policy blocks Google's SDK
# servers. See README.md in this repo for the full rationale.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
WWW_DIR="$ROOT/www"
BUILD_DIR="$ROOT/build"
FRAMEWORK_RES="/usr/share/android-framework-res/framework-res.apk"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/assets/www"

echo "==> Regenerating sprites"
python3 "$ROOT/tools/gen_sprites.py"
python3 "$ROOT/tools/gen_icon.py"

echo "==> Staging web assets"
cp -r "$WWW_DIR"/* "$BUILD_DIR/assets/www/"

echo "==> Assembling classes.dex from Smali"
smali assemble -a 33 -o "$BUILD_DIR/classes.dex" "$ANDROID_DIR/smali/"

echo "==> Packaging resources + manifest + assets with aapt"
aapt package -f \
  -M "$ANDROID_DIR/AndroidManifest.xml" \
  -S "$ANDROID_DIR/res" \
  -A "$BUILD_DIR/assets" \
  -I "$FRAMEWORK_RES" \
  -F "$BUILD_DIR/unsigned.apk"

echo "==> Adding classes.dex to the package"
(cd "$BUILD_DIR" && zip -qj unsigned.apk classes.dex)

echo "==> zipaligning"
zipalign -f -p 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"

KEYSTORE="$ROOT/tools/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
  echo "==> Generating debug signing keystore"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" -storepass neonrunner -keypass neonrunner \
    -alias neonrunner -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=Neon Runner, OU=Dev, O=Neon Runner, L=City, S=State, C=US"
fi

echo "==> Signing"
apksigner sign --ks "$KEYSTORE" --ks-pass pass:neonrunner --key-pass pass:neonrunner \
  --out "$BUILD_DIR/neon-runner.apk" "$BUILD_DIR/aligned.apk"

echo "==> Verifying"
apksigner verify --verbose "$BUILD_DIR/neon-runner.apk"
zipalign -c -v 4 "$BUILD_DIR/neon-runner.apk" > /dev/null && echo "zipalign OK"

echo "==> Done: $BUILD_DIR/neon-runner.apk"
ls -la "$BUILD_DIR/neon-runner.apk"
