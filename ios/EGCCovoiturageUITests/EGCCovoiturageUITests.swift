import XCTest

final class EGCCovoiturageUITests: XCTestCase {
  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  @MainActor
  func testScreenshots() throws {
    let app = XCUIApplication()
    setupSnapshot(app)

    let email = launchArgumentValue(app, key: "SNAPSHOT_EMAIL")
    let password = launchArgumentValue(app, key: "SNAPSHOT_PASSWORD")

    app.launch()

    // Native Expo splash is held ~2.5s in snapshot mode — capture before it hides.
    Thread.sleep(forTimeInterval: 1.0)
    snapshot("00_Splash", timeWaitingForIdle: 0)

    let home = app.otherElements["screen-home"]
    if !home.waitForExistence(timeout: 20) {
      try loginAsParent(app, email: email, password: password)
      XCTAssertTrue(
        home.waitForExistence(timeout: 45),
        "Home screen did not appear after parent login"
      )
    }

    snapshot("01_Accueil")

    tapTab(app, named: "Trajets")
    XCTAssertTrue(app.otherElements["screen-trips"].waitForExistence(timeout: 15))
    snapshot("02_Trajets")

    tapTab(app, named: "Messages")
    XCTAssertTrue(app.otherElements["screen-messages"].waitForExistence(timeout: 15))
    snapshot("03_Messages")

    tapTab(app, named: "Profil")
    XCTAssertTrue(app.otherElements["screen-profile"].waitForExistence(timeout: 15))
    snapshot("04_Profil")
  }

  @MainActor
  private func loginAsParent(
    _ app: XCUIApplication,
    email: String?,
    password: String?
  ) throws {
    XCTAssertNotNil(email, "SNAPSHOT_EMAIL missing from launch arguments")
    XCTAssertNotNil(password, "SNAPSHOT_PASSWORD missing from launch arguments")

    let login = element(app, id: "screen-login")
    XCTAssertTrue(
      login.waitForExistence(timeout: 15),
      "Login screen did not appear (cannot fall back to UI login)"
    )

    // RN TouchableOpacity is often exposed as "Other", not Button
    let parentById = element(app, id: "login-mode-parent")
    if parentById.waitForExistence(timeout: 5) {
      parentById.tap()
    } else {
      let parentLabel = app.staticTexts["Parent / Encadrant"]
      XCTAssertTrue(parentLabel.waitForExistence(timeout: 5), "Parent mode tab not found")
      parentLabel.tap()
    }

    let emailField = firstExisting(
      app.textFields["login-email"],
      app.textFields["votre@email.com"],
      app.textFields.matching(NSPredicate(format: "placeholderValue == %@", "votre@email.com")).element
    )
    XCTAssertTrue(emailField.waitForExistence(timeout: 5), "Email field not found")
    emailField.tap()
    emailField.typeText(email!)

    let passwordField = firstExisting(
      app.secureTextFields["login-password"],
      app.secureTextFields.matching(NSPredicate(format: "placeholderValue CONTAINS %@", "•")).element
    )
    XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
    passwordField.tap()
    passwordField.typeText(password!)

    let submit = firstExisting(
      element(app, id: "login-submit"),
      app.buttons["Se connecter"],
      app.staticTexts["Se connecter"]
    )
    XCTAssertTrue(submit.waitForExistence(timeout: 5), "Login submit not found")
    submit.tap()
  }

  private func element(_ app: XCUIApplication, id: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: id).firstMatch
  }

  private func firstExisting(_ elements: XCUIElement...) -> XCUIElement {
    for element in elements {
      if element.waitForExistence(timeout: 2) {
        return element
      }
    }
    return elements[0]
  }

  private func launchArgumentValue(_ app: XCUIApplication, key: String) -> String? {
    let args = app.launchArguments
    guard let index = args.firstIndex(of: "-\(key)"), index + 1 < args.count else {
      return nil
    }
    return args[index + 1]
  }

  @MainActor
  private func tapTab(_ app: XCUIApplication, named name: String) {
    let tab = app.tabBars.buttons[name]
    if tab.waitForExistence(timeout: 5) {
      tab.tap()
      return
    }

    let testID: String
    switch name {
    case "Trajets": testID = "tab-trajets"
    case "Messages": testID = "tab-messages"
    case "Profil": testID = "tab-profil"
    case "Accueil": testID = "tab-accueil"
    default: testID = "tab-\(name.lowercased())"
    }

    let byId = element(app, id: testID)
    XCTAssertTrue(byId.waitForExistence(timeout: 5), "Tab \(name) not found")
    byId.tap()
  }
}
