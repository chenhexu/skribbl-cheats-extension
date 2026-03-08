# Chrome Web Store — Privacy form (copy-paste)

Use the text below in the **Privacy** section of your Chrome Web Store listing. Fixes: single purpose and host permission now mention Auto-Drawer; remote code set to **No** with matching justification.

---

## Single purpose description *

```
This extension helps users on skribbl.io in two ways: (1) It parses the game hint and suggests or sends matching guesses from a built-in word list, with optional automation. (2) An optional Auto-Drawer lets users upload an image and have it drawn on the game canvas. All logic runs locally; no user data is sent to any server.
```

*(~195 characters)*

---

## storage justification *

```
The storage permission is used to save the user's preferences locally (e.g. panel position, delay, dot prefix, refresh rates, optional Auto-Drawer settings) and optionally a cached word list. All data stays on the user's device; nothing is sent to any server.
```

*(~175 characters)*

---

## Host permission justification *

```
The extension runs only on skribbl.io. Host permission is needed to read the on-screen hint and guess input (for word suggestions and sending guesses) and to draw on the game canvas when using the optional Auto-Drawer. It does not run on any other sites.
```

*(~175 characters)*

---

## Debugger justification *

```
The debugger permission is used only for the optional Auto-Drawer feature. When the user enables it, the extension uses the Chrome DevTools Protocol to simulate mouse input on the game canvas so the chosen image can be drawn. It attaches only to the skribbl.io tab the user is on; no data is sent to any server or other tab.
```

*(~215 characters)*

---

## Are you using remote code?

**Select:** **No, I am not using remote code**

## Justification * (when “No” is selected, you may still need to provide this)

```
All extension logic runs from the packaged scripts. No JavaScript or WebAssembly is loaded from external URLs, and no code is evaluated from remote strings. The optional Auto-Drawer uses the Chrome DevTools Protocol to simulate mouse input on the same tab only; this does not constitute remote code under the store's definition.
```

*(~215 characters)*

---

*Last updated for store submission.*
