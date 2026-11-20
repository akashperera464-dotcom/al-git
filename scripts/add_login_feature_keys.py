#!/usr/bin/env python3
"""Add the three login feature-pill labels (auth.feature*) to en/si/ta locales.

Inserted right after auth.heroSubheadlineMobile so the hero copy stays together.
json.dump with indent=2 + ensure_ascii=False matches the repo's locale files
(UTF-8, 2-space indent). A trailing newline is appended to match git's diff.
"""
import json
from pathlib import Path

LOCALES = Path("src/i18n/locales")

# label per locale, keyed by i18n suffix
LABELS = {
    "en": {
        "featureTeaLands": "Tea Lands",
        "featureWeather": "Weather",
        "featureDeliveries": "Leaf Deliveries",
    },
    "si": {
        "featureTeaLands": "තේ ඉඩම්",
        "featureWeather": "කාලගුණය",
        "featureDeliveries": "කොළ භාරදීම්",
    },
    "ta": {
        "featureTeaLands": "தேயிலை நிலங்கள்",
        "featureWeather": "வானிலை",
        "featureDeliveries": "இலை விநியோகங்கள்",
    },
}

ANCHOR = "heroSubheadlineMobile"

for suffix, labels in LABELS.items():
    path = LOCALES / f"{suffix}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    auth = data["auth"]
    for key, value in labels.items():
        if key in auth:
            print(f"{suffix}: {key} already exists -> {auth[key]!r} (overwriting)")
        auth[key] = value
    # rebuild auth preserving order, with the three new keys after the anchor
    reordered = {}
    for k, v in auth.items():
        reordered[k] = v
        if k == ANCHOR:
            for nk, nv in labels.items():
                reordered[nk] = nv
    data["auth"] = reordered
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{path}: inserted {list(labels)}")
