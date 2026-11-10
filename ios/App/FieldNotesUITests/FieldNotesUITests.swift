import XCTest
import UIKit

final class FieldNotesUITests: XCTestCase {
    private func revealNavigation(_ app: XCUIApplication) {
        let handle = app.descendants(matching: .any)["Show navigation"].firstMatch
        if handle.exists && handle.isHittable { handle.tap() }
    }

    private func waitForText(_ text: String, in element: XCUIElement, timeout: TimeInterval = 15) {
        // WebKit can still be processing native keystrokes after typeText
        // returns. Require the entire input before testing its persistence.
        let complete = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (element.value as? String)?.contains(text) == true
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: timeout), .completed,
                       "The entire intended input must arrive before checks. Actual: \(String(describing: element.value))")
    }

    private func revealSoftwareKeyboard(_ app: XCUIApplication) {
        if app.keyboards.firstMatch.waitForExistence(timeout: 2) { return }
        // iPad can restore text focus with only its system shortcut bar.
        // Use the normal system Keyboard > Show Keyboard control if present.
        if UIDevice.current.userInterfaceIdiom == .pad {
            let keyboardButton = app.buttons["Keyboard"].firstMatch
            if keyboardButton.exists && keyboardButton.isHittable {
                keyboardButton.tap()
                let show = app.descendants(matching: .any)["Show Keyboard"].firstMatch
                if show.waitForExistence(timeout: 2) { show.tap() }
            }
        }
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
    }

    private func capture(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testNativeWidgetGallery() throws {
        executionTimeAllowance = 180
        continueAfterFailure = false
        XCUIDevice.shared.press(.home)
        let home = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let icon = home.icons["Field Notes Test"].firstMatch
        for _ in 0..<3 {
            if icon.exists { break }
            home.swipeLeft()
        }
        XCTAssertTrue(icon.waitForExistence(timeout: 15), "The separate test app is installed")
        icon.press(forDuration: 1.5)
        capture(home, "Native widget context menu")
        let editHome = home.buttons["Edit Home Screen"].firstMatch
        if !editHome.exists {
            let options = home.buttons["Options"].firstMatch
            XCTAssertTrue(options.waitForExistence(timeout: 5))
            options.tap()
        }
        XCTAssertTrue(editHome.waitForExistence(timeout: 5))
        editHome.tap()
        capture(home, "Home Screen editing for native widgets")
        let edit = home.buttons["Edit"].firstMatch
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        let add = home.buttons["Add Widget"].firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 10))
        add.tap()
        capture(home, "Native WidgetKit gallery")
        let search = home.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        search.tap()
        search.typeText("Field Notes Test")
        capture(home, "Field Notes WidgetKit gallery search")
        let app = home.staticTexts["Field Notes Test"].firstMatch
        XCTAssertTrue(app.waitForExistence(timeout: 10))
        app.tap()
        capture(home, "Field Notes native widget preview")
        XCTAssertTrue(home.buttons["Add Widget"].firstMatch.waitForExistence(timeout: 10))
    }

    func testCalendarHeaderClearsStatusArea() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.buttons["Quick note"].firstMatch.waitForExistence(timeout: 30))
        revealNavigation(app)
        app.descendants(matching: .any)["Today — go to"].tap()
        app.webViews.links["Calendar"].firstMatch.tap()
        let month = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "open the day agenda")).firstMatch
        XCTAssertTrue(month.waitForExistence(timeout: 10))
        XCTAssertGreaterThanOrEqual(month.frame.minY, UIDevice.current.userInterfaceIdiom == .pad ? 20 : 44, "The calendar title clears the device status area")
        capture(app, "Calendar header below iPhone status area")
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        let landscape = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in app.frame.width > app.frame.height }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [landscape], timeout: 10), .completed)
        XCTAssertTrue(month.waitForExistence(timeout: 10))
        capture(app, "Calendar landscape safe edges")
        XCUIDevice.shared.orientation = .portrait
        app.terminate()
    }

    func testKeyboardFormattingDock() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.buttons["Quick note"].firstMatch.waitForExistence(timeout: 30))
        revealNavigation(app)
        app.descendants(matching: .any)["Add"].tap()
        app.webViews.descendants(matching: .any)["New page"].firstMatch.tap()
        let editor = app.webViews.textViews["Page"].firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 15))
        editor.tap()
        let sample = (1...18).map { "Line \($0)\n" }.joined() + "VISIBLE CARET"
        editor.typeText(sample)
        waitForText("VISIBLE CARET", in: editor, timeout: 45)
        XCTAssertTrue((editor.value as? String)?.contains("VISIBLE CARET") == true, "The last typed line is exposed in the editor viewport")
        let done = app.webViews.buttons["Hide keyboard"].firstMatch
        XCTAssertTrue(done.waitForExistence(timeout: 10), "The native formatting dock appears with the keyboard")
        let keyboard = app.keyboards.firstMatch
        XCTAssertTrue(keyboard.exists)
        XCTAssertLessThanOrEqual(done.frame.maxY, keyboard.frame.minY + 2, "Formatting controls sit above the software keyboard")
        XCTAssertGreaterThanOrEqual(done.frame.height, 44)
        capture(app, "Native note formatting dock above keyboard")
        app.descendants(matching: .any)["Style"].firstMatch.tap()
        // CodeMirror virtualizes the AX value, so compare the visible marker;
        // exact document/selection equality is tested through its public API.
        XCTAssertTrue((editor.value as? String)?.contains("VISIBLE CARET") == true, "Expanded formatting keeps the current line in the editor viewport")
        let bold = app.descendants(matching: .any)["Bold — ⌘B"].firstMatch
        XCTAssertTrue(bold.waitForExistence(timeout: 10))
        bold.tap()
        XCTAssertTrue(keyboard.exists, "Formatting preserves editor focus and keyboard")
        capture(app, "Full formatting tools at keyboard")
        done.tap()
        let hidden = NSPredicate(format: "exists == false")
        expectation(for: hidden, evaluatedWith: keyboard)
        waitForExpectations(timeout: 10)
        XCTAssertTrue(app.descendants(matching: .any)["Style"].firstMatch.waitForExistence(timeout: 10), "The resting top toolbar returns")
        capture(app, "Resting note after keyboard dismissal")
        app.terminate()
    }

    func testSwipeDismissalAndBackPreserveNote() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.buttons["Quick note"].firstMatch.waitForExistence(timeout: 30))
        revealNavigation(app)
        app.descendants(matching: .any)["Add"].tap()
        app.webViews.descendants(matching: .any)["New page"].firstMatch.tap()
        let editor = app.webViews.textViews["Page"].firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 15))
        editor.tap()
        let note = "Swipe dismissal note \(UUID().uuidString.prefix(8))"
        editor.typeText(note)
        waitForText(note, in: editor)
        let keyboard = app.keyboards.firstMatch
        XCTAssertTrue(keyboard.exists)
        let start = editor.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.15))
        let end = editor.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.65))
        start.press(forDuration: 0.01, thenDragTo: end)
        let hidden = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: keyboard)
        XCTAssertEqual(XCTWaiter.wait(for: [hidden], timeout: 10), .completed, "A downward editor swipe hides the keyboard")
        XCTAssertTrue((editor.value as? String)?.contains(note) == true)
        capture(app, "Note reading after downward keyboard dismissal")
        // Return to the written line; a large text view's center can be blank stock.
        app.webViews.staticTexts[note].firstMatch.tap()
        revealSoftwareKeyboard(app)
        let back = app.descendants(matching: .any)["Back to notebook"].firstMatch
        XCTAssertTrue(back.waitForExistence(timeout: 10))
        XCTAssertTrue(back.isHittable, "Back remains accessible while editing")
        back.tap()
        let saved = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", note)).firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout: 10), "Back saves the note in its notebook")
        app.terminate()
    }

    func testHomeMonthStaysCompactAcrossRotation() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.buttons["Quick note"].firstMatch.waitForExistence(timeout: 30))
        // XCTest includes the landmark type in this label (", region").
        let month = app.webViews.otherElements.matching(NSPredicate(format: "label BEGINSWITH %@", "Month overview")).firstMatch
        XCTAssertTrue(month.waitForExistence(timeout: 10))
        XCTAssertLessThanOrEqual(month.frame.height, 500)
        let days = month.descendants(matching: .button).matching(NSPredicate(format: "label MATCHES %@", "[0-9]{4}-[0-9]{2}-[0-9]{2}"))
        XCTAssertGreaterThanOrEqual(days.count, 35, "Every week is available")
        XCTAssertLessThanOrEqual(days.element(boundBy: days.count - 1).frame.maxY, month.frame.maxY + 1)
        if UIDevice.current.userInterfaceIdiom == .pad {
            XCTAssertLessThanOrEqual(month.frame.maxY, app.descendants(matching: .any)["Today — go to"].firstMatch.frame.minY, "Tablet month clears navigation")
        }
        capture(app, "Home compact month portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        let landscape = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in app.frame.width > app.frame.height }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [landscape], timeout: 10), .completed)
        XCTAssertLessThanOrEqual(month.frame.height, 500)
        XCTAssertGreaterThanOrEqual(days.count, 35)
        XCTAssertLessThanOrEqual(days.element(boundBy: days.count - 1).frame.maxY, month.frame.maxY + 1)
        if UIDevice.current.userInterfaceIdiom == .pad {
            XCTAssertLessThanOrEqual(month.frame.maxY, app.descendants(matching: .any)["Today — go to"].firstMatch.frame.minY)
        }
        capture(app, "Home compact month landscape")
        app.terminate()
    }

    func testEditingSurvivesRotation() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.buttons["Quick note"].firstMatch.waitForExistence(timeout: 30))
        revealNavigation(app)
        app.descendants(matching: .any)["Add"].tap()
        app.webViews.descendants(matching: .any)["New page"].firstMatch.tap()
        let editor = app.webViews.textViews["Page"].firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 15))
        editor.tap()
        let note = "Rotation note \(UUID().uuidString.prefix(8))"
        editor.typeText(note)
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        let landscape = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in app.frame.width > app.frame.height }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [landscape], timeout: 10), .completed)
        XCTAssertTrue((editor.value as? String)?.contains(note) == true, "Rotation preserves the current note")
        editor.typeText(" continued")
        app.descendants(matching: .any)["Style"].firstMatch.tap()
        XCTAssertTrue(app.descendants(matching: .any)["Bold — ⌘B"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue((editor.value as? String)?.contains("continued") == true)
        capture(app, "Editing and formatting after rotation")
        app.descendants(matching: .any)["Hide keyboard"].firstMatch.tap()
        let hidden = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.keyboards.firstMatch)
        XCTAssertEqual(XCTWaiter.wait(for: [hidden], timeout: 10), .completed)
        XCTAssertTrue((editor.value as? String)?.contains(note) == true)
        app.terminate()
    }

    func testDraftAutosavesWithoutDone() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let quickNote = app.webViews.buttons["Quick note"].firstMatch
        XCTAssertTrue(quickNote.waitForExistence(timeout: 30))
        quickNote.tap()
        let draft = app.webViews.textViews["Quick note"].firstMatch
        XCTAssertTrue(draft.waitForExistence(timeout: 10))
        draft.tap()
        let note = "\nAutosaved iOS draft \(UUID().uuidString.prefix(8))"
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        draft.typeText(note)
        waitForText(note, in: draft)
        let typed = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        typed.name = "Draft immediately after test typing"
        typed.lifetime = .keepAlways
        add(typed)
        let savedText = try XCTUnwrap(draft.value as? String)
        XCTAssertTrue(savedText.contains(note), "Typed text is present before lifecycle checks. Actual: \(savedText)")

        // Leave the sheet open: normal phone interruptions cannot depend on Done.
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(app.wait(for: .runningBackground, timeout: 10))
        app.activate()
        XCTAssertTrue(draft.waitForExistence(timeout: 10))
        XCTAssertEqual(draft.value as? String, savedText)

        app.terminate()
        app.launch()
        XCTAssertTrue(quickNote.waitForExistence(timeout: 30))
        quickNote.tap()
        XCTAssertTrue(draft.waitForExistence(timeout: 10))
        XCTAssertEqual(draft.value as? String, savedText,
                       "An open, unfiled draft survives backgrounding and native process restart")
        let reopened = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        reopened.name = "Autosaved open draft after native relaunch"
        reopened.lifetime = .keepAlways
        add(reopened)
        app.webViews.buttons["Done"].tap()
    }

    func testQuickNoteSurvivesAppTermination() throws {
        // iPad XCTest can spend a full minute awaiting a keyboard animation
        // notification before each native action, independently of app input.
        executionTimeAllowance = 180
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()

        let quickNote = app.webViews.buttons["Quick note"].firstMatch
        XCTAssertTrue(quickNote.waitForExistence(timeout: 30), "The bundled Field Notes interface opens")
        quickNote.tap()

        let draft = app.webViews.textViews["Quick note"].firstMatch
        XCTAssertTrue(draft.waitForExistence(timeout: 10))
        draft.tap()
        let note = "Field Notes iOS pilot \(UUID().uuidString.prefix(8))\nSaved on this simulated iPhone."
        // Keep earlier test text on repeat runs. This is an unpaired simulator.
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        draft.typeText(note)
        waitForText(note, in: draft)
        let typed = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        typed.name = "Draft immediately after test typing"
        typed.lifetime = .keepAlways
        add(typed)
        XCTAssertTrue((draft.value as? String)?.contains(note) == true, "Actual: \(String(describing: draft.value))")
        let savedText = try XCTUnwrap(draft.value as? String)
        app.webViews.buttons["Done"].tap()
        XCTAssertTrue(quickNote.waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        XCTAssertTrue(quickNote.waitForExistence(timeout: 30))
        quickNote.tap()
        XCTAssertTrue(draft.waitForExistence(timeout: 10))
        XCTAssertEqual(draft.value as? String, savedText, "The complete note survives a native process restart")

        let reopened = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        reopened.name = "Saved note after native app relaunch"
        reopened.lifetime = .keepAlways
        add(reopened)
        app.webViews.buttons["Done"].tap()

        let today = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        today.name = "Field Notes installed iOS app"
        today.lifetime = .keepAlways
        add(today)
    }
}
