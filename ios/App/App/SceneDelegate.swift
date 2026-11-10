import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = FieldNotesViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// The keyboard plugin caches the iPad shortcut-bar height. Expanding that bar
// can otherwise keep reporting zero while the full software keyboard covers
// the page. Measure every frame change in this app window instead. iPhone
// continues using the existing plugin without this override.
final class FieldNotesViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        guard UIDevice.current.userInterfaceIdiom == .pad else { return }
        for name in [UIResponder.keyboardWillChangeFrameNotification,
                     UIResponder.keyboardDidChangeFrameNotification,
                     UIResponder.keyboardDidHideNotification] {
            NotificationCenter.default.addObserver(self, selector: #selector(keyboardFrameChanged(_:)), name: name, object: nil)
        }
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    @objc private func keyboardFrameChanged(_ notification: Notification) {
        guard let webView = webView, let window = webView.window else { return }
        if let local = notification.userInfo?[UIResponder.keyboardIsLocalUserInfoKey] as? Bool, !local { return }
        let height: CGFloat
        if notification.name == UIResponder.keyboardDidHideNotification {
            height = 0
        } else {
            guard let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
            let screen = (notification.object as? UIScreen) ?? window.screen
            guard screen === window.screen else { return }
            let converted = screen.coordinateSpace.convert(frame, to: webView)
            let overlap = webView.bounds.intersection(converted)
            // A floating keyboard does not own the whole window's bottom.
            let docked = !overlap.isEmpty && converted.maxY >= webView.bounds.maxY - 2
                && overlap.width >= webView.bounds.width * 0.9
            height = docked ? max(0, webView.bounds.maxY - overlap.minY) : 0
        }
        bridge?.triggerWindowJSEvent(eventName: "fieldNotesKeyboardFrame", data: "{\"keyboardHeight\":\(Int(height.rounded()))}")
    }
}
