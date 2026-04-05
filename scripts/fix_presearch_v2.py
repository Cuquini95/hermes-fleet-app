"""Fix presearch to score individual parts by description match, not just section match."""
path = "/root/.hermes/hermes-agent/gateway/context_loader.py"
with open(path, "r") as f:
    code = f.read()

# Replace the scoring logic in search_catalog_parts
old = """    if "parts" in data and isinstance(data["parts"], list):
        # CAT/Mack format
        for p in data["parts"]:
            desc = p.get("description", "").lower()
            sys_name = p.get("system", "").lower()
            score = sum(1 for t in terms if t in desc or t in sys_name)
            if score > 0:
                matches.append((score, p["part_number"], p["description"], p.get("system", "")))
    else:
        # Komatsu/Doosan format
        for section, items in data.items():
            if not isinstance(items, dict):
                continue
            section_lower = section.lower()
            for pn, desc in items.items():
                desc_lower = str(desc).lower()
                score = sum(1 for t in terms if t in desc_lower or t in section_lower)
                if score > 0:
                    matches.append((score, pn, desc, section))"""

new = """    if "parts" in data and isinstance(data["parts"], list):
        # CAT/Mack format
        for p in data["parts"]:
            desc = p.get("description", "").lower()
            sys_name = p.get("system", "").lower()
            # Score by description match (high priority)
            desc_score = sum(3 for t in terms if t in desc)
            # Score by system match (lower priority)
            sys_score = sum(1 for t in terms if t in sys_name)
            score = desc_score + sys_score
            if desc_score > 0:  # Must match description, not just system
                matches.append((score, p["part_number"], p["description"], p.get("system", "")))
    else:
        # Komatsu/Doosan format
        for section, items in data.items():
            if not isinstance(items, dict):
                continue
            section_lower = section.lower()
            for pn, desc in items.items():
                desc_lower = str(desc).lower()
                # Score by description match (high priority)
                desc_score = sum(3 for t in terms if t in desc_lower)
                # Score by section match (lower, only if desc also somewhat matches)
                sec_score = sum(1 for t in terms if t in section_lower)
                if desc_score > 0:
                    # Direct description match - best results
                    matches.append((desc_score + sec_score, pn, desc, section))
                elif sec_score >= 2 and len(str(desc)) > 3:
                    # Section matches strongly - include as secondary
                    matches.append((sec_score, pn, desc, section))"""

code = code.replace(old, new)

with open(path, "w") as f:
    f.write(code)
print("Fixed presearch scoring - description matches prioritized")
