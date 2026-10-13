const {
  withAppDelegate,
  withInfoPlist,
} = require('expo/config-plugins');

const MARKER = '// Window / React Native startup is handled by SceneDelegate';
const SNAPSHOT_MARKER = 'persistSnapshotLaunchArguments()';

const SNAPSHOT_HELPER = `
extension AppDelegate {
  private static let snapshotLaunchKeys: Set<String> = [
    "FASTLANE_SNAPSHOT",
    "SNAPSHOT_EMAIL",
    "SNAPSHOT_PASSWORD",
    "ui_testing",
  ]

  static func persistSnapshotLaunchArguments() {
    let args = ProcessInfo.processInfo.arguments
    let defaults = UserDefaults.standard
    var index = 0
    while index < args.count {
      let arg = args[index]
      if arg.hasPrefix("-") {
        let key = String(arg.dropFirst())
        if snapshotLaunchKeys.contains(key), index + 1 < args.count {
          defaults.set(args[index + 1], forKey: key)
          index += 2
          continue
        }
      }
      index += 1
    }
  }
}
`;

const SCENE_DELEGATE_CLASS = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions
    )

    // Expo modules / RN internals resolve the window via the app delegate.
    appDelegate.window = window
    self.window = window

    for context in connectionOptions.urlContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
    for activity in connectionOptions.userActivities {
      _ = RCTLinkingManager.application(
        UIApplication.shared,
        continue: activity,
        restorationHandler: { _ in }
      )
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
`;

function ensureSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function ensureSceneDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withUiSceneLifecycle only supports Swift AppDelegate');
    }

    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) {
      // Still ensure snapshot launch-arg persistence for prebuild re-runs.
      contents = ensureSnapshotPersistence(contents);
      cfg.modResults.contents = contents;
      return cfg;
    }

    // Prefer @main for scene-based apps.
    contents = contents.replace('@UIApplicationMain', '@main');

    if (!contents.includes('var launchOptions:')) {
      contents = contents.replace(
        'var reactNativeFactory: RCTReactNativeFactory?',
        'var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?'
      );
    }

    // Store launch options early in didFinishLaunching.
    if (!contents.includes('self.launchOptions = launchOptions')) {
      contents = contents.replace(
        /didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\? = nil\n  \) -> Bool \{\n/,
        (match) => `${match}    self.launchOptions = launchOptions\n\n`
      );
    }

    // Remove legacy window creation from AppDelegate.
    contents = contents.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n\n/,
      `${MARKER}\n\n`
    );

    if (!contents.includes('class SceneDelegate:')) {
      contents = contents.replace(
        /\nclass ReactNativeDelegate:/,
        `\n${SCENE_DELEGATE_CLASS}\nclass ReactNativeDelegate:`
      );
    }

    contents = ensureSnapshotPersistence(contents);
    cfg.modResults.contents = contents;
    return cfg;
  });
}

function ensureSnapshotPersistence(contents) {
  if (!contents.includes(SNAPSHOT_MARKER)) {
    contents = contents.replace(
      /self\.launchOptions = launchOptions\n\n/,
      `self.launchOptions = launchOptions\n\n    // RN SettingsManager only exposes dictionaryRepresentation, which omits the\n    // volatile NSArgumentDomain. Copy Fastlane Snapshot -KEY VALUE launch args\n    // into the app domain so JS can read SNAPSHOT_* / FASTLANE_SNAPSHOT.\n    Self.persistSnapshotLaunchArguments()\n\n`
    );
  }

  if (!contents.includes('static func persistSnapshotLaunchArguments()')) {
    contents = contents.replace(
      /\nclass ReactNativeDelegate:/,
      `\n${SNAPSHOT_HELPER}\nclass ReactNativeDelegate:`
    );
  }

  return contents;
}

/**
 * Adopts UIKit UIScene lifecycle required by Xcode 27 / iOS 27 SDK.
 * Also persists Fastlane Snapshot launch args into UserDefaults for RN Settings.
 */
function withUiSceneLifecycle(config) {
  config = ensureSceneManifest(config);
  config = ensureSceneDelegate(config);
  return config;
}

module.exports = withUiSceneLifecycle;
