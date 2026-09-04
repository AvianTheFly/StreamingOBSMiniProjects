# Hotkey Editor

Browser-based editor for media mini projects.

## Runtime Files

- `editor.html`: application shell served by `server.py`.
- `components/`: small HTML partials loaded by the shell.
- `assets/css/`: shared styles split into focused modules.
- `assets/js/`: editor bootstrap plus focused JavaScript modules.
- `server.py`: local HTTP/API server used by the top-level `hotkey_editor.py`.

## Reusable Media Trim Picker

- `assets/js/modules/media-trim-picker.js`
- `assets/css/modules/media-trim-picker.css`
- `media-trim-picker-demo.html`

Basic use:

```html
<link rel="stylesheet" href="assets/css/styles.css">
<media-trim-button label="Choose media clip"></media-trim-button>
<script type="module" src="assets/js/modules/media-trim-picker.js"></script>
```

JavaScript use:

```js
import { createMediaTrimButton } from './assets/js/modules/media-trim-picker.js';

createMediaTrimButton({
  target: '#media-picker-slot',
  label: 'Choose media clip',
  onSave(result) {
    console.log(result.fileName, result.blob);
  },
});
```

## Backups

The old single-file editor backup was moved out of the runtime tree to:

`archive/editor_backups/hotkey_editor_original_editor.html`
