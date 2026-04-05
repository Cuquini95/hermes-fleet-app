"""Fix all broken catalogs on VPS:
1. D65EX-16: Parse figures→parts nested structure
2. DX360LCA: Re-extract from DX360LCA_PARTS_LOOKUP.md
3. Mack GR84B: Re-extract from MACK_GR84B_PARTS_LOOKUP.md
4. D155AX-6: Deduplicate and fill empty descriptions
5. HM400-3: Deduplicate
"""
import json, os, re

CATALOG_DIR = "/root/.hermes/references/maintenance"


def fix_d65px16():
    """D65EX-16: Parse the figures→parts nested structure into flat format."""
    path = os.path.join(CATALOG_DIR, "d65px16_parts_catalog.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    figures = data.get("figures", [])
    flat = {}
    for fig in figures:
        title = fig.get("title", "")
        for p in fig.get("parts", []):
            pn = p.get("part_number", "").strip()
            desc = p.get("description", "").strip()
            if pn and desc and len(pn) >= 3:
                section = title if title else "General"
                if section not in flat:
                    flat[section] = {}
                if pn not in flat[section]:
                    flat[section][pn] = desc

    # Save as sectioned format
    with open(path, "w", encoding="utf-8") as f:
        json.dump(flat, f, indent=2, ensure_ascii=False)

    total = sum(len(v) for v in flat.values() if isinstance(v, dict))
    print(f"D65EX-16: Fixed — {total} unique parts from {len(figures)} figures")


def fix_dx360lca():
    """DX360LCA: Build catalog from PARTS_LOOKUP.md and PARTES_ES.md."""
    parts = {}
    for md_name in ["DX360LCA_PARTS_LOOKUP.md", "DX360LCA_PARTES_ES.md"]:
        md_path = os.path.join(CATALOG_DIR, md_name)
        if not os.path.exists(md_path):
            continue
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract part numbers from markdown tables and lists
        # Pattern: | **PART_NUMBER** | Description |
        for match in re.finditer(r'\*\*([A-Z0-9][\w-]{3,})\*\*\s*\|?\s*([^|\n]+)', content):
            pn = match.group(1).strip()
            desc = match.group(2).strip()
            if pn and desc and len(pn) >= 3:
                parts[pn] = desc

        # Pattern: P/N XXXX or Part# XXXX
        for match in re.finditer(r'(?:P/N|Part#?|PN)\s*:?\s*([A-Z0-9][\w-]{3,})\s*[-—:]\s*([^\n|]+)', content):
            pn = match.group(1).strip()
            desc = match.group(2).strip()
            if pn and desc:
                parts[pn] = desc

        # Pattern: numbered lines like: 300516-00074  STARTER MOTOR
        for match in re.finditer(r'(\d{5,}-\d{4,})\s+([A-Z][A-Za-z\s,;()]+)', content):
            pn = match.group(1).strip()
            desc = match.group(2).strip()
            if len(desc) > 3:
                parts[pn] = desc

    path = os.path.join(CATALOG_DIR, "dx360lca_parts_catalog.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"DX360LCA Parts": parts}, f, indent=2, ensure_ascii=False)
    print(f"DX360LCA: Fixed — {len(parts)} parts extracted from MD files")


def fix_mack():
    """Mack GR84B: Build proper catalog from MACK_GR84B_PARTS_LOOKUP.md."""
    parts = {}
    for md_name in ["MACK_GR84B_PARTS_LOOKUP.md", "mack_gr84b_pm_v2.md", "mack_gr84b_pm_section.md"]:
        md_path = os.path.join(CATALOG_DIR, md_name)
        if not os.path.exists(md_path):
            continue
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract from markdown tables: | **PN** | Description |
        for match in re.finditer(r'\*\*(\d{5,})\*\*\s*\|?\s*([^|\n]+)', content):
            pn = match.group(1).strip()
            desc = match.group(2).strip()
            if pn and desc and len(desc) > 2:
                parts[pn] = desc

        # Pattern: PN: Description or PN — Description
        for match in re.finditer(r'(\d{7,})\s*[-—|:]+\s*([^\n|]+)', content):
            pn = match.group(1).strip()
            desc = match.group(2).strip()
            if desc and len(desc) > 2 and not desc.startswith("TB-"):
                parts[pn] = desc

        # Pattern: Part# 12345678
        for match in re.finditer(r'(?:Part#?|P/N|PN)\s*:?\s*(\d{7,})\s*[-—:,]\s*([^\n]+)', content):
            pn = match.group(1).strip()
            desc = match.group(2).strip()
            if desc:
                parts[pn] = desc

    path = os.path.join(CATALOG_DIR, "mack_gr84b_parts_catalog.json")

    # Keep existing build_sheet data if it has real parts
    existing = {}
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            existing = json.load(f)

    # Merge: MD parts take priority
    final = {"Mack GR84B Parts": parts}
    if "parts" in existing and isinstance(existing["parts"], list):
        for p in existing["parts"]:
            pn = p.get("part_number", "")
            desc = p.get("description", "")
            if pn and desc and pn != "identity" and len(pn) >= 5:
                if pn not in parts:
                    parts[pn] = desc

    with open(path, "w", encoding="utf-8") as f:
        json.dump(final, f, indent=2, ensure_ascii=False)
    print(f"Mack GR84B: Fixed — {len(parts)} parts from MD + existing data")


def dedup_catalog(name):
    """Remove duplicates and empty descriptions from a sectioned catalog."""
    path = os.path.join(CATALOG_DIR, f"{name}_parts_catalog.json")
    if not os.path.exists(path):
        print(f"{name}: File not found")
        return

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "parts" in data and isinstance(data["parts"], list):
        # Flat format — deduplicate by part_number
        seen = {}
        unique = []
        removed = 0
        for p in data["parts"]:
            pn = p.get("part_number", "")
            desc = p.get("description", "")
            if pn in seen:
                # Keep the one with the longer description
                if len(desc) > len(seen[pn].get("description", "")):
                    # Replace the existing one
                    for i, u in enumerate(unique):
                        if u.get("part_number") == pn:
                            unique[i] = p
                            break
                removed += 1
                continue
            seen[pn] = p
            unique.append(p)

        data["parts"] = unique
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"{name}: Deduped — {removed} duplicates removed, {len(unique)} unique parts")
    else:
        # Sectioned format — deduplicate across sections
        all_pns = {}
        removed = 0
        for section, items in data.items():
            if not isinstance(items, dict):
                continue
            to_remove = []
            for pn, desc in items.items():
                if not desc or str(desc).strip() == "":
                    to_remove.append(pn)
                    removed += 1
                elif pn in all_pns:
                    # Keep the one with better description
                    if len(str(desc)) <= len(str(all_pns[pn])):
                        to_remove.append(pn)
                        removed += 1
                    else:
                        all_pns[pn] = desc
                else:
                    all_pns[pn] = desc
            for pn in to_remove:
                del items[pn]

        # Remove empty sections
        empty_sections = [s for s, items in data.items() if isinstance(items, dict) and not items]
        for s in empty_sections:
            del data[s]

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        total = sum(len(v) for v in data.values() if isinstance(v, dict))
        print(f"{name}: Deduped — {removed} removed, {total} remaining, {len(empty_sections)} empty sections removed")


if __name__ == "__main__":
    print("=== FIXING ALL CATALOGS ===\n")

    print("1. Fixing D65EX-16 (figures→flat)...")
    fix_d65px16()

    print("\n2. Fixing DX360LCA (from MD files)...")
    fix_dx360lca()

    print("\n3. Fixing Mack GR84B (from MD files)...")
    fix_mack()

    print("\n4. Deduplicating D155AX-6...")
    dedup_catalog("d155ax6")

    print("\n5. Deduplicating HM400-3...")
    dedup_catalog("hm400")

    print("\n6. Deduplicating DX340LCA...")
    dedup_catalog("dx340lca")

    print("\n7. Deduplicating DX225LCA...")
    dedup_catalog("dx225lca")

    print("\n=== ALL FIXES COMPLETE ===")
