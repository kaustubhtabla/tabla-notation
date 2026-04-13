# Bhatkhande.io

A browser-based tabla notation writer for composing, editing, saving, and exporting Indian classical tabla compositions in Bhatkhande notation.

## Features

- Create and edit tabla compositions in the browser
- Work with multiple taals and composition types
- Save compositions through the bundled Python sync server
- Import and export compositions as JSON
- Export compositions as PDF

## Run locally

1. Make sure you have Python 3 installed.
2. Start the local server:

```bash
python3 server.py
```

3. Open [http://localhost:8080](http://localhost:8080) in your browser.

The app serves the frontend and stores saved compositions in `data/compositions.json`.

## Project structure

- `index.html` - app shell
- `css/styles.css` - application styling
- `js/` - editor, notation grid, composition logic, and PDF export
- `server.py` - local sync server for saved compositions
- `data/compositions.json` - stored compositions
