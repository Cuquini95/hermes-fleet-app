"""Fix context_loader.py to score systems by relevance."""
path = "/root/.hermes/hermes-agent/gateway/context_loader.py"
with open(path, "r") as f:
    code = f.read()

old = '''                if "parts" in data and isinstance(data["parts"], list):
                    # CAT/Mack format: {parts: [{part_number, description, system}]}
                    by_system = {}
                    for p in data["parts"]:
                        sys = p.get("system", "GENERAL")
                        if sys not in by_system:
                            by_system[sys] = []
                        by_system[sys].append(p)
                    for sys, parts_list in sorted(by_system.items()):
                        lines.append(f"\\n=== {sys} ===")
                        for p in parts_list:
                            lines.append(f"  P/N {p['part_number']}: {p['description']} (qty:{p.get('qty',1)})")'''

new = '''                if "parts" in data and isinstance(data["parts"], list):
                    # CAT/Mack format: {parts: [{part_number, description, system}]}
                    q_terms = [t.lower() for t in equipo.replace("-", " ").split() if len(t) >= 3]

                    by_system = {}
                    for p in data["parts"]:
                        sys_name = p.get("system", "GENERAL")
                        if sys_name not in by_system:
                            by_system[sys_name] = []
                        by_system[sys_name].append(p)

                    # Score systems by relevance
                    scored = []
                    for sys_name, plist in by_system.items():
                        score = 0
                        for t in q_terms:
                            if t in sys_name.lower():
                                score += 10
                            for p in plist:
                                if t in p.get("description", "").lower():
                                    score += 2
                        scored.append((score, sys_name, plist))

                    scored.sort(key=lambda x: -x[0])

                    # Relevant systems first with qty, then rest without
                    for score, sys_name, plist in scored:
                        lines.append("\\n=== " + sys_name + " ===")
                        for p in plist:
                            pn = p["part_number"]
                            desc = p["description"]
                            qty = p.get("qty", 1)
                            if score > 0:
                                lines.append("  P/N " + pn + ": " + desc + " (qty:" + str(qty) + ")")
                            else:
                                lines.append("  P/N " + pn + ": " + desc)'''

code = code.replace(old, new)

with open(path, "w") as f:
    f.write(code)
print("Done")
