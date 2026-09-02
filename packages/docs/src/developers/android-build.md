# Building Nuclear for Android (APK)

This guide covers building the native Nuclear Android APK using Tauri v2 Mobile.

## Prerequisites

To build locally, you need:
- **Rust toolchain** with Android targets:
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
  ```
- **Java OpenJDK 17** (Temurin or similar).
- **Android SDK & NDK** (NDK r26+ and Android Platform 34). Set environment variables:
  ```bash
  export ANDROID_HOME="/path/to/android-sdk"
  export NDK_HOME="$ANDROID_HOME/ndk/26.1.10909125"
  ```

## Building the APK Locally

1. Install dependencies and build frontend:
   ```bash
   pnpm install
   pnpm build
   ```

2. Initialize Android target:
   ```bash
   pnpm tauri:android:init
   ```

3. Build the APK package:
   ```bash
   pnpm tauri:android
   ```

The compiled APK will be located in:
`packages/player/src-tauri/gen/android/app/build/outputs/apk/release/app-release-unsigned.apk`

## Automated 1-Click Build via GitHub Actions

You can build the APK without installing any mobile build tools locally:
1. Push your repository to GitHub.
2. Go to **Actions** > **Build Android APK**.
3. Click **Run workflow**.
4. Once completed, download the `nuclear-android-apk` artifact containing the installable `.apk` file.
