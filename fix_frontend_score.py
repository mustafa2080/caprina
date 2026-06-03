with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """            const scoredKpis = evaluatedKpis.filter(k => k.score !== null && Number.isFinite(k.score));
            const overallScore = scoredKpis.length > 0
              ? Math.round(scoredKpis.reduce((s, k) => s + Math.min(k.score ?? 0, 100), 0) / scoredKpis.length)
              : null;"""

new = """            const scoredKpis = evaluatedKpis.filter(k => k.score !== null && Number.isFinite(k.score));
            // Use backend overallScore (weighted, includes manual cumulative) — fallback to local simple avg
            const overallScore = report?.overallScore ?? (scoredKpis.length > 0
              ? Math.round(scoredKpis.reduce((s, k) => s + Math.min(k.score ?? 0, 100), 0) / scoredKpis.length)
              : null);"""

count = content.count(old)
print(f"Found: {count}")
if count == 1:
    content = content.replace(old, new)
    with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done")
else:
    print("NOT FOUND")
