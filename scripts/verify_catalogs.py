"""Verify all catalog part numbers across all equipment.
Runs 1000+ lookups to check data quality."""
import json, os

CATALOG_DIR = "/root/.hermes/references/maintenance"

# Load all catalogs
catalogs = {}
for fname in os.listdir(CATALOG_DIR):
    if not fname.endswith("_parts_catalog.json"):
        continue
    path = os.path.join(CATALOG_DIR, fname)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_parts = []
    if "parts" in data and isinstance(data["parts"], list):
        for p in data["parts"]:
            all_parts.append({
                "pn": p.get("part_number", ""),
                "desc": p.get("description", ""),
                "section": p.get("system", ""),
            })
    else:
        for section, items in data.items():
            if isinstance(items, dict):
                for pn, desc in items.items():
                    all_parts.append({"pn": pn, "desc": str(desc), "section": section})

    model = fname.replace("_parts_catalog.json", "")
    catalogs[model] = all_parts

print("=== CATALOG INVENTORY ===")
grand_total = 0
for model in sorted(catalogs.keys()):
    ct = len(catalogs[model])
    grand_total += ct
    print(f"  {model}: {ct} parts")
print(f"  TOTAL: {grand_total} parts")

# Components to search for
components = [
    ("starter", ["starter", "starting motor", "motor de arranque"]),
    ("alternator", ["alternator", "alternador"]),
    ("belt", ["belt", "banda", "v-belt", "serpentine"]),
    ("oil filter", ["oil filter", "filtro aceite", "filter.*oil"]),
    ("fuel filter", ["fuel filter", "filtro combustible", "fuel.*filter"]),
    ("air filter", ["air filter", "filtro aire", "air.*filter"]),
    ("hydraulic filter", ["hydraulic filter", "filtro hidraulico"]),
    ("fuel injector", ["injector", "inyector", "fuel inject"]),
    ("turbocharger", ["turbo", "turbocharger"]),
    ("radiator", ["radiator", "radiador"]),
    ("water pump", ["water pump", "bomba agua"]),
    ("hydraulic pump", ["hydraulic pump", "bomba hidraulic"]),
    ("battery", ["battery", "bateria"]),
    ("engine oil", ["engine oil", "aceite motor"]),
]

print("\n=== COMPONENT SEARCH RESULTS ===")
print(f"{'Model':<18} | {'Component':<18} | {'Found':<6} | {'Top Part Number':<20} | {'Description'}")
print("-" * 110)

total_searches = 0
total_found = 0
total_missing = 0
missing_list = []

for model in sorted(catalogs.keys()):
    parts = catalogs[model]
    for comp_name, search_terms in components:
        total_searches += 1
        matches = []
        for p in parts:
            desc_lower = p["desc"].lower()
            section_lower = p["section"].lower()
            for term in search_terms:
                if term in desc_lower or term in section_lower:
                    matches.append(p)
                    break

        if matches:
            total_found += 1
            # Show the most relevant match (shortest description = most likely the assembly)
            best = sorted(matches, key=lambda x: len(x["desc"]))[:1]
            for m in best:
                print(f"  {model:<16} | {comp_name:<18} | {len(matches):<6} | {m['pn']:<20} | {m['desc'][:50]}")
        else:
            total_missing += 1
            missing_list.append(f"{model}/{comp_name}")

print(f"\n=== SUMMARY ===")
print(f"Total searches: {total_searches}")
print(f"Found: {total_found}")
print(f"Missing: {total_missing}")
print(f"Coverage: {total_found/total_searches*100:.1f}%")

if missing_list:
    print(f"\n=== MISSING ({total_missing}) ===")
    for m in missing_list:
        print(f"  {m}")

# Validate part number formats
print(f"\n=== PART NUMBER FORMAT VALIDATION ===")
import re
bad_format = []
for model, parts in catalogs.items():
    for p in parts:
        pn = p["pn"]
        # Check for suspicious patterns
        if re.match(r'^AST\d', pn) or re.match(r'^XXX', pn) or pn == "PLACEHOLDER":
            bad_format.append(f"{model}: {pn} = {p['desc']}")

if bad_format:
    print(f"FAKE/PLACEHOLDER PART NUMBERS FOUND: {len(bad_format)}")
    for b in bad_format:
        print(f"  {b}")
else:
    print("No fake/placeholder part numbers detected")

# Count parts with empty descriptions
empty_desc = sum(1 for model, parts in catalogs.items() for p in parts if not p["desc"].strip())
print(f"\nParts with empty descriptions: {empty_desc}")

# Count duplicate part numbers within same catalog
for model, parts in catalogs.items():
    pns = [p["pn"] for p in parts]
    dupes = len(pns) - len(set(pns))
    if dupes > 0:
        print(f"  {model}: {dupes} duplicate part numbers")
