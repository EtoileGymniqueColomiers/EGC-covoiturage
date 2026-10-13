import Expo
import React
import ReactAppDependencyProvider

@main
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.launchOptions = launchOptions

    // RN SettingsManager only exposes dictionaryRepresentation, which omits the
    // volatile NSArgumentDomain. Copy Fastlane Snapshot -KEY VALUE launch args
    // into the app domain so JS can read SNAPSHOT_* / FASTLANE_SNAPSHOT.
    Self.persistSnapshotLaunchArguments()

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    // Window / React Native startup is handled by SceneDelegate (UIScene lifecycle).
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

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

extension AppDelegate {
  private static let snapshotLaunchKeys: Set<String> = [
    "FASTLANE_SNAPSHOT",
    "SNAPSHOT_EMAIL",
    "SNAPSHOT_PASSWORD",
    "ui_testing",
  ]

  static func isSnapshotLaunch() -> Bool {
    let args = ProcessInfo.processInfo.arguments
    if let index = args.firstIndex(of: "-FASTLANE_SNAPSHOT"), index + 1 < args.count {
      let value = args[index + 1]
      return value == "YES" || value == "1" || value == "true"
    }
    return UserDefaults.standard.bool(forKey: "FASTLANE_SNAPSHOT")
      || (UserDefaults.standard.string(forKey: "FASTLANE_SNAPSHOT") == "YES")
  }

  static func persistSnapshotLaunchArguments() {
    let args = ProcessInfo.processInfo.arguments
    let defaults = UserDefaults.standard
    var index = 0
    var persisted: [String] = []
    while index < args.count {
      let arg = args[index]
      if arg.hasPrefix("-") {
        let key = String(arg.dropFirst())
        if snapshotLaunchKeys.contains(key), index + 1 < args.count {
          defaults.set(args[index + 1], forKey: key)
          persisted.append(key)
          index += 2
          continue
        }
      }
      index += 1
    }
    defaults.synchronize()
    NSLog("[EGC Snapshot] Persisted launch args: \(persisted.joined(separator: ", "))")
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
    // Fastlane Snapshot must use the embedded bundle — Metro shows "Bundling XX%".
    if AppDelegate.isSnapshotLaunch() {
      return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    }
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
