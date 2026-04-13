import json
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer

DATA_DIR = "data"
REPO_DB_FILE = os.path.join(DATA_DIR, "compositions.json")
DB_FILE = os.environ.get("BHATKHANDE_DB_FILE", os.path.join(DATA_DIR, "compositions.local.json"))
LEGACY_BUILT_IN_TITLE = "Built-in Dilli Kayda"
LEGACY_BUILT_IN_NOTE = "Starter Dilli kayda loaded as a built-in example composition."
STALE_PARTIAL_IMPORT_IDS = {
    "comp_mnhgdlg6_9hvxrt"
}

def is_legacy_built_in(item):
    return (
        isinstance(item, dict) and
        item.get("title") == LEGACY_BUILT_IN_TITLE and
        item.get("notes") == LEGACY_BUILT_IN_NOTE and
        item.get("gharana") == "Delhi"
    )

def is_pristine_untitled(item):
    if not isinstance(item, dict):
        return False

    title = item.get("title")
    laya = item.get("laya")
    gharana = item.get("gharana", "")
    guru = item.get("guru", "")
    notes = item.get("notes", "")
    composition_type = item.get("compositionType")
    taal_id = item.get("taalId")
    sections = item.get("sections")

    if (
        title != "Untitled Composition" or
        laya != "madhya" or
        gharana != "" or
        guru != "" or
        notes != ""
    ):
        return False

    if composition_type == "theka":
        expected_sections = [{
            "type": "mukh",
            "label": "Theka",
            "avartans": [{
                "matras": [{"bols": [bol]} for bol in {
                    "teentaal": ['Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ta', 'Dhin', 'Dhin', 'Dha'],
                    "rupak": ['Ti', 'Ti', 'Na', 'Dhi', 'Na', 'Dhi', 'Na'],
                    "jhaptaal": ['Dhi', 'Na', 'Dhi', 'Dhi', 'Na', 'Ti', 'Na', 'Dhi', 'Dhi', 'Na'],
                    "ektaal": ['Dhin', 'Dhin', 'DhaGe', 'Tirakita', 'Tu', 'Na', 'Kat', 'Ta', 'DhaGe', 'Tirakita', 'Dhin', 'Na'],
                    "dhamar": ['Ka', 'Dhi', 'Tay', 'Dhi', 'Tay', 'Dha', 'S', 'Ga', 'Ti', 'Tay', 'Ti', 'Tay', 'Ta', 'S'],
                    "adachautaal": ['Dhin', 'Tirakita', 'Dhi', 'Na', 'Tu', 'Na', 'Kat', 'Ta', 'Tirakita', 'Dhi', 'Na', 'Dhi', 'Dhi', 'Na'],
                    "dadra": ['Dha', 'Dhi', 'Na', 'Dha', 'Tu', 'Na'],
                    "keherwa": ['Dha', 'Ge', 'Na', 'Ti', 'Na', 'Ka', 'Dhi', 'Na'],
                    "chautaal": ['Dha', 'Dha', 'Din', 'Ta', 'Kita', 'Dha', 'Din', 'Ta', 'TeTe', 'KaTa', 'GaDi', 'GaNa'],
                    "sooltaal": ['Dha', 'Dha', 'Din', 'Ta', 'Kita', 'Dha', 'TeTe', 'KaTa', 'GaDi', 'GaNa'],
                    "jhoomra": ['Dhin', 'S', 'Dha', 'Tirakita', 'Dhin', 'Dhin', 'DhaGe', 'Tirakita', 'Tin', 'S', 'Ta', 'Tirakita', 'Dhin', 'Dhin'],
                    "tilwada": ['Dha', 'TirKit', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'TirKit', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin'],
                    "deepchandi": ['Dha', 'Dhin', 'S', 'Dha', 'Dha', 'Tin', 'S', 'Ta', 'Tin', 'S', 'Dha', 'Dha', 'Dhin', 'S'],
                    "panchamsawari": ['Dhi', 'Na', 'Dhi Dhi', 'Kat', 'Dhi Dhi', 'Na Dhi', 'Dhi Na', 'Ti Kra', 'Tin Na', 'Tirakita', 'Tu Na', 'Kat Ta', 'Dhi Dhi', 'Na Dhi', 'Dhi Na']
                }.get(taal_id, [])]
            }]
        }]
    else:
        expected_sections = [{
            "type": "mukh",
            "label": "Main",
            "avartans": [{
                "matras": [{"bols": []} for _ in range(len((sections or [{}])[0].get("avartans", [{}])[0].get("matras", [])))]
            }]
        }]

    return sections == expected_sections

def is_stale_partial_doc_import(item):
    if not isinstance(item, dict):
        return False

    if item.get("id") in STALE_PARTIAL_IMPORT_IDS:
        return True

    if (
        item.get("title") != "Untitled Composition" or
        item.get("taalId") != "jhaptaal" or
        item.get("compositionType") != "kayda"
    ):
        return False

    try:
        first_matras = item["sections"][0]["avartans"][0]["matras"][:4]
        signature = [tuple(matra.get("bols", [])) for matra in first_matras]
    except Exception:
        return False

    return signature in (
        [("DHAGE",), ("TIRAKIT",), ("DHINA",), ("Gina",)],
        [("DHAGE",), ("TIRAKIT",), ("DHINA",), ("GINA",)]
    )

def sanitize_saved_list(data):
    if not isinstance(data, list):
        return []
    return [
        item for item in data
        if not is_legacy_built_in(item)
        and not is_pristine_untitled(item)
        and not is_stale_partial_doc_import(item)
    ]

def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)

def bootstrap_db_file():
    ensure_data_dir()
    if os.path.exists(DB_FILE):
        return

    seed_data = []
    if DB_FILE != REPO_DB_FILE and os.path.exists(REPO_DB_FILE):
        try:
            with open(REPO_DB_FILE, 'r', encoding='utf-8') as f:
                seed_data = sanitize_saved_list(json.load(f))
            if seed_data:
                print(f"Migrated existing compositions from {REPO_DB_FILE} to {DB_FILE}.")
        except Exception as err:
            print(f"Could not migrate seed data from {REPO_DB_FILE}: {err}")
            seed_data = []

    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(seed_data, f, ensure_ascii=False)

def load_saved_list():
    bootstrap_db_file()
    with open(DB_FILE, 'r', encoding='utf-8') as f:
        return sanitize_saved_list(json.load(f))

def write_saved_list(data):
    bootstrap_db_file()
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(sanitize_saved_list(data), f, ensure_ascii=False)

class SyncHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/compositions':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            data = load_saved_list()
            write_saved_list(data)
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/compositions':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            # Parse to ensure valid JSON
            try:
                data = json.loads(post_data.decode('utf-8'))
                write_saved_list(data)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
            except Exception as e:
                print("Error saving:", e)
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    port = 8080
    bootstrap_db_file()
    server_address = ('', port)
    httpd = HTTPServer(server_address, SyncHandler)
    print(f"bhatkhande.io Sync Server running on port {port} using {DB_FILE}...")
    httpd.serve_forever()
