# Neon Runner: Blackout City

A cyberpunk 2D platformer — procedural pixel-art sprites, a synthwave
soundtrack synthesized at runtime, dynamic neon lighting, a WebGL CRT/bloom
shader pass, a 3-sector story, and an Android APK build pipeline that doesn't
depend on Google's Android SDK servers.

## Play it in a browser

```
cd www && python3 -m http.server 8000
```

Open `http://localhost:8000`. Keyboard: arrows/WASD to move, Up/W/Space to
jump (double-jump in the air). On touch, use the on-screen buttons.

## Project layout

```
www/                  the game itself (open www/index.html to play)
  index.html, style.css
  js/
    levels.js          tilemap geometry for the 3 sectors (rect-based, not hand-typed ASCII)
    entities.js        physics, collision, Player/Enemy classes
    lighting.js         screen-space additive neon lighting
    shader.js           WebGL post-process pass (scanlines, chromatic aberration, bloom, vignette)
    audio.js             procedural synthwave music + SFX (Web Audio API, no audio files)
    story.js             narrative text
    main.js               game state machine, input, rendering, HUD
  assets/sprites/       generated pixel-art PNGs (see tools/gen_sprites.py)
tools/
  gen_sprites.py         regenerates every sprite/background PNG
  gen_icon.py             regenerates the launcher icon
  build_apk.sh             builds android/build/neon-runner.apk end-to-end
android/
  AndroidManifest.xml
  smali/                   MainActivity, hand-written in Smali (see below)
  res/mipmap-*/            launcher icon
```

## Why the APK is built from Smali instead of Gradle

The environment this was built in blocks all of Google's Android
infrastructure at the network level (`dl.google.com`, `maven.google.com`,
`android.googlesource.com`), which is where the standard Android SDK, the
Android Gradle Plugin, and the Java→Dalvik bytecode compiler (d8/dx) are
normally downloaded from. There's also no Android emulator or physical
device available in that environment to test a compiled APK against.

Instead, the build uses older tools Debian/Ubuntu package directly
(`aapt`, `zipalign`, `apksigner`, `smali`/`baksmali`, `android-framework-res`).
Those cover everything except the dex compiler, which also isn't packaged —
so `MainActivity` (a single Activity that hosts a full-screen `WebView`
pointed at the bundled game in `assets/www/`) is written directly in Smali
and assembled to `classes.dex` with `smali assemble`, rather than compiled
from Java.

This was validated as thoroughly as possible without a device:
`baksmali` round-trips the assembled dex back to source-identical Smali,
`aapt dump badging` parses the manifest/resources cleanly, and
`apksigner verify` confirms valid v1/v2/v3 signatures. What could **not**
be verified is that it actually launches on a real phone — there's no
substitute for that test, so treat the APK as best-effort until you've
installed it once.

**If you have Android Studio / the Android SDK available locally**, the more
robust path is to drop `www/` into a standard WebView-wrapper Gradle project
and build normally — that gives you a real, fully-verified Gradle/AGP build
instead of this workaround.

## Rebuilding the APK

```
./tools/build_apk.sh
```

Regenerates sprites/icon, assembles the dex, packages resources+assets,
zipaligns, and signs with a throwaway debug keystore (auto-generated at
`tools/debug.keystore`, gitignored). Output: `build/neon-runner.apk`.

## Installing

Enable "Install unknown apps" for your file manager / browser, then open the
APK. The app requests no permissions (no network access — everything is
bundled locally) and locks to landscape orientation.
