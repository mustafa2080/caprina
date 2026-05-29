import sys
sys.stdout.reconfigure(encoding="utf-8")

analytics = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\analytics.ts"
with open(analytics, encoding="utf-8") as f:
    content = f.read()

# ── Fix 1: Add cache to smart-insights ──────────────────────────────────────────
# Find the handler beginning
old_si = '''"/analytics/smart-insights", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const smBaseConditions: any[] = [isNull(ordersTable.deletedAt)];
  if (tenantId !== null) smBaseConditions.push(eq(ordersTable.tenantId, tenantId));
  const [allOrders, products, variants, allManifests, allManifestOrders] = await Promise.all(['''

new_si = '''"/analytics/smart-insights", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const siCacheKey = `smart-insights:${tenantId ?? "global"}`;
  const siCached = getCached<any>(siCacheKey);
  if (siCached) { res.json(siCached); return; }
  const smBaseConditions: any[] = [isNull(ordersTable.deletedAt)];
  if (tenantId !== null) smBaseConditions.push(eq(ordersTable.tenantId, tenantId));
  const [allOrders, products, variants, allManifests, allManifestOrders] = await Promise.all(['''

# ── Fix 2: Add cache to charts ──────────────────────────────────────────────────
old_charts = '''"/analytics/charts", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const chartsBaseConditions: any[] = [isNull(ordersTable.deletedAt)];
  if (tenantId !== null) chartsBaseConditions.push(eq(ordersTable.tenantId, tenantId));

  const manifestsChartConditions: any[] = [];
  if (tenantId !== null) manifestsChartConditions.push(sql.raw(`shipping_manifests.tenant_id = ${tenantId}`));

  const [allOrders, chartsManifests, chartsManifestOrders] = await Promise.all(['''

new_charts = '''"/analytics/charts", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const chartsCacheKey = `charts:${tenantId ?? "global"}`;
  const chartsCached = getCached<any>(chartsCacheKey);
  if (chartsCached) { res.json(chartsCached); return; }
  const chartsBaseConditions: any[] = [isNull(ordersTable.deletedAt)];
  if (tenantId !== null) chartsBaseConditions.push(eq(ordersTable.tenantId, tenantId));

  const manifestsChartConditions: any[] = [];
  if (tenantId !== null) manifestsChartConditions.push(sql.raw(`shipping_manifests.tenant_id = ${tenantId}`));

  const [allOrders, chartsManifests, chartsManifestOrders] = await Promise.all(['''

changed = 0

if old_si in content:
    content = content.replace(old_si, new_si, 1)
    changed += 1
    print("OK Added cache check to smart-insights")
else:
    print("MISS smart-insights handler not found")

if old_charts in content:
    content = content.replace(old_charts, new_charts, 1)
    changed += 1
    print("OK Added cache check to charts")
else:
    print("MISS charts handler not found")

# ── Fix 3: Find where smart-insights sends res.json and add setCached before it ──
# Look for the pattern near the end of smart-insights handler
old_si_end = '''  res.json({ stars, deadStock, returnInsights, stockPredictor, adAttribution });
});'''
new_si_end = '''  const siResult = { stars, deadStock, returnInsights, stockPredictor, adAttribution };
  setCached(siCacheKey, siResult, 15 * 60 * 1000); // 15 min cache
  res.json(siResult);
});'''

if old_si_end in content:
    content = content.replace(old_si_end, new_si_end, 1)
    changed += 1
    print("OK Added setCached to smart-insights response")
else:
    print("MISS smart-insights res.json end not found")
    # Try to find it
    idx = content.find("stars, deadStock, returnInsights")
    if idx >= 0:
        print(f"  Found nearby: {repr(content[idx-20:idx+120])}")

# ── Fix 4: Find charts res.json and add setCached ──
old_charts_end = '''  res.json({ statusBreakdown, weeklySales: days, monthlySales: monthDays, adSourceBreakdown, total, weekComparison,'''
new_charts_end = '''  const chartsResult = { statusBreakdown, weeklySales: days, monthlySales: monthDays, adSourceBreakdown, total, weekComparison,'''

if old_charts_end in content:
    content = content.replace(old_charts_end, new_charts_end, 1)
    # Now find the closing of that res.json and wrap it
    idx = content.find("const chartsResult = { statusBreakdown")
    closing = content.find("});", idx)
    if closing >= 0:
        old_close = content[closing:closing+3]
        # Find what's between chartsResult = { ... }
        # Replace res.json( with setCached + res.json(
        res_json_old = content[idx:closing+3]
        # change "const chartsResult =" to keep, and add setCached + res.json after
        res_json_new = res_json_old.replace(
            "const chartsResult = {",
            "const chartsResult = {"
        )
        # Actually simpler: just replace the full line
        # Find the _debug line and replace the whole res.json call
        pass
    changed += 1
    print("OK charts result variable created")
else:
    print("MISS charts res.json not found")
    idx = content.find("statusBreakdown, weeklySales")
    if idx >= 0:
        print(f"  Found nearby: {repr(content[idx-20:idx+100])}")

if changed > 0:
    with open(analytics, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\nSaved {changed} fixes to analytics.ts")
