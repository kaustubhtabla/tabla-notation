#!/usr/bin/env python3

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE = REPO_ROOT / "data" / "library.json"
TARGET = REPO_ROOT / "js" / "library-data.js"


def main():
    library = json.loads(SOURCE.read_text(encoding="utf-8"))
    payload = json.dumps(library, ensure_ascii=False, separators=(",", ":"))
    output = (
        "// Generated from data/library.json by scripts/build-library-fallback.py\n"
        "window.BHATKHANDE_LIBRARY_DATA = "
        f"{payload};\n"
    )
    TARGET.write_text(output, encoding="utf-8")


if __name__ == "__main__":
    main()
