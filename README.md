# Bhatkhande.io

A browser-based tabla notation writer for composing, editing, saving, and exporting Indian classical tabla compositions in Bhatkhande notation.

Public site: `https://kaustubhtabla.github.io/tabla-notation/`
Workspace: `https://kaustubhtabla.github.io/tabla-notation/app.html`

## Features

- Create and edit tabla compositions in the browser
- Work with multiple taals and composition types
- Save compositions through the bundled Python sync server
- Import and export compositions as JSON
- Export compositions as PDF
- Reopen PDFs exported from the current app version

## Run locally

1. Make sure you have Python 3 installed.
2. Start the local server:

```bash
python3 server.py
```

3. Open [http://localhost:8080](http://localhost:8080) in your browser.

The app serves the frontend and stores local runtime saves in `data/compositions.local.json`.
On the first run after this workflow update, the server will migrate any existing data from `data/compositions.json` into that local file automatically.

### Contact form email setup

The landing page contact form now posts to the bundled Python server at `/api/contact`.
To let it send email directly, set these environment variables before starting `server.py`:

```bash
export BHATKHANDE_CONTACT_TO_EMAIL=kaustnbh@gmail.com
export BHATKHANDE_CONTACT_FROM_EMAIL=kaustnbh@gmail.com
export BHATKHANDE_CONTACT_SMTP_HOST=smtp.gmail.com
export BHATKHANDE_CONTACT_SMTP_PORT=587
export BHATKHANDE_CONTACT_SMTP_USERNAME=kaustnbh@gmail.com
export BHATKHANDE_CONTACT_SMTP_PASSWORD='your-gmail-app-password'
```

For Gmail, use an App Password rather than your normal account password.

## Hosted version

The public GitHub Pages root now acts as the marketing / startup page.
Open the actual notation workspace at `/app.html`.

- The landing page is accessible from anywhere through the public site URL
- The notation editor is accessible at `/app.html`
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
