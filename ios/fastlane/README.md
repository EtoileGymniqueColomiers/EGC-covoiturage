fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios pods

```sh
[bundle exec] fastlane ios pods
```

Install CocoaPods

### ios bump_build

```sh
[bundle exec] fastlane ios bump_build
```

Bump iOS build number (CFBundleVersion)

### ios build

```sh
[bundle exec] fastlane ios build
```

Build App Store IPA (signed via ASC API key — no Xcode GUI)

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Build + upload to TestFlight

### ios upload

```sh
[bundle exec] fastlane ios upload
```

Upload an existing IPA to TestFlight

### ios screenshots

```sh
[bundle exec] fastlane ios screenshots
```

Capture App Store screenshots (demo login via SNAPSHOT_* env)

### ios upload_screenshots

```sh
[bundle exec] fastlane ios upload_screenshots
```

Upload screenshots from fastlane/screenshots to App Store Connect

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
