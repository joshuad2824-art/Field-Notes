# Field Notes widgets for Joshua

Development build — the new Field Notes links and calendar connection are **not published yet**. Keep the early prototype until Siena confirms the release is ready. No new calendar key has been created or installed for you.

Each widget has its own script, so you can arrange them freely:

| Script | Suggested size | Tap opens |
| --- | --- | --- |
| Field Notes Calendar.js | Large | The full month in Field Notes |
| Field Notes Weather.js | Medium or large | Field Notes’ weather view |
| Field Notes Quick Note.js | Small | The existing Quick Note window |
| Field Notes Date.js | Small, optional | Today’s Field Notes day view |

The calendar supports small and medium sizes too, with smaller numbers. A large widget keeps the whole month easiest to read. It starts on Sunday, highlights today, rings dates with writing and shades dates with events. The whole widget opens the month; individual date taps are not implemented. Six-week months and leap years are supported.

## Add the widgets, after release

1. Save this folder in Files on your iPhone.
2. Open **Field Notes Calendar.js** in Files, use Share, and choose Scriptable if offered. If that option is absent, open the file as text, copy its contents, open Scriptable, tap **+**, paste, tap the title to name it **Field Notes Calendar**, and tap **Done**.
3. Repeat for Weather and Quick Note. Date is optional.
4. Return to the iPhone Home Screen. Touch and hold an empty area, then use **Edit → Add Widget** (or the **+** button) and search for **Scriptable**.
5. Add a **large** Scriptable widget. Touch and hold it, choose **Edit Widget**, and choose **Field Notes Calendar** under Script. Set the tap action to **Open URL** if Scriptable offers that setting. Leave Parameter empty.
6. Add another Scriptable widget for Weather, and a small one for Quick Note, each choosing its matching script. Drag them into the arrangement you like.

Use Scriptable’s play button to preview a script. Running Calendar offers Preview, Connect calendar marks, and Forget this device’s calendar key. Running Weather or Quick Note only previews it.

## Connect the calendar marks, after approval

The month itself works without a connection. Its writing and event marks need a separate, limited connection.

1. Open Field Notes in your already-paired browser or installed app. Open **Settings → Widgets**.
2. Read the date-marker permission. Check **Allow Scriptable to read calendar date markers**, then tap **Connect calendar**. This is the explicit action that creates a read-only widget credential, valid for 90 days. Connecting on a different device replaces an older widget connection.
3. Copy the **private widget setup code** shown there. Do not copy your archive pairing code, and do not send either code in chat or include it in a screenshot.
4. In Scriptable, run **Field Notes Calendar**, choose **Connect calendar marks**, and paste the private widget setup code into its secure field.
5. Look at the preview, then return to the Home Screen. iOS chooses when the Home Screen image next refreshes.

Scriptable stores this setup in its Keychain. It receives only marked dates, calendar-source status, timezone and snapshot timestamps. It never receives your archive key, note text, event names, locations or calendar credentials. The server stores a hash of the widget key.

The calendar snapshot updates while this paired device has Field Notes open. It includes the previous, current and next month, with their outside grid dates. If other devices or calendar services change something, open Field Notes, let it sync, then use **Update widget** if needed. A snapshot timestamp is not a promise of live data. Partial, offline and old snapshots are labeled; unavailable/unconnected outside calendars cannot supply marks. Source calendars keep their existing permissions; setting up this widget does not connect a new calendar.

To remove server access, use **Revoke calendar widget** in Field Notes Settings. To remove the phone’s local copy, also run Calendar in Scriptable and choose **Forget this device’s calendar key**, then remove the Home Screen widget if desired. The phone cannot learn about a remote revocation until it reconnects; an already rendered Home Screen image may remain until iOS refreshes it.

## Weather and Quick Note

Weather uses **Tulsa, Fahrenheit**, through Open-Meteo, the same provider as Field Notes. It does not ask for your GPS location or require an API key. The place is independent of Field Notes’ saved browser weather settings. Tell Siena if you want another town or Celsius. Medium shows the current reading and upcoming high temperatures; large adds a five-day forecast. A failed refresh keeps a labeled cached reading for up to 24 hours, then shows Weather unavailable. Provider: https://open-meteo.com/

Quick Note opens the app’s existing window. An unfiled thought stays in that browser’s draft; choosing a notebook and tapping Done files it through the app’s normal save and sync path. Typing happens in Field Notes, not inside the Home Screen widget.

A link may open Safari rather than the installed Field Notes app; iOS decides that handoff. If it opens an unpaired browser, the widget link shows **Connect this browser** instead of silently creating a separate note archive. Use the app’s existing Sync pairing flow in that browser, or return to the paired app. Never put the archive pairing code or vault key into Scriptable. This Safari/installed-app behavior still needs testing on Joshua’s physical iPhone.

## What still needs a device check

- Actual Scriptable layout on your iPhone and iPad, including widget-size and text-size settings.
- Whether taps open the paired Field Notes context or require the existing browser pairing step.
- Real calendar refresh after approval, plus an offline/reconnect check.
- iOS refresh timing; scripts request a refresh after 30 minutes, but the system may take longer.

Scriptable documentation: https://docs.scriptable.app/listwidget/ and https://docs.scriptable.app/widgetstack/.
