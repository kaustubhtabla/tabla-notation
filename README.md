# Bhatkhande.io

A browser-based tabla notation writer for composing, editing, saving, and exporting Indian classical tabla compositions in Bhatkhande notation.

Public site: `https://kaustubhtabla.github.io/tabla-notation/`

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

The app serves the frontend and stores local runtime saves in `data/compositions.local.json`.
On the first run after this workflow update, the server will migrate any existing data from `data/compositions.json` into that local file automatically.

## Hosted version

The public GitHub Pages version runs entirely in the browser.

- It is accessible from anywhere through the public site URL
- Saved compositions on the hosted version stay in that browser's local storage
- Shared cloud sync still requires running the Python server yourself

## Development and publishing

- Make and test changes on the `codex/dev` branch
- Commit your changes there first
- Publish the current branch to the live site with:

```bash
./scripts/publish-site.sh
```

- Preview the publish checks without changing GitHub:

```bash
./scripts/publish-site.sh --dry-run
```

The publish script updates `main`, which is the branch GitHub Pages uses for the public site.

## Project structure

- `index.html` - app shell
- `css/styles.css` - application styling
- `js/` - editor, notation grid, composition logic, and PDF export
- `server.py` - local sync server for saved compositions
- `data/compositions.json` - stored compositions
