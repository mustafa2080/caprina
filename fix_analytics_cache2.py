import sys
sys.stdout.reconfigure(encoding="utf-8")

analytics = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\analytics.ts"
with open(analytics, encoding="utf-8") as f:
    content = f.read()

# Fix smart-insights response - wrap in cache
old_si_json = '''  res.json({
    adAttribution: { bestSource, breakdown: adBreakdown },
    stars,
    deadStock,
    returnInsights: { byReason, highReturnProducts, totalReturnRate, totalReturns },
    stockPredictor,
  });
});

// ─── GET /api/analytics/charts'''

new_si_json = '''  const siResult = {
    adAttribution: { bestSource, breakdown: adBreakdown },
    stars,
    deadStock,
    returnInsights: { byReason, highReturnProducts, totalReturnRate, totalReturns },
    stockPredictor,
  };
  setCached(siCacheKey, siResult, 15 * 60 * 1000); // 15 min cache
  res.json(siResult);
});

// ─── GET /api/analytics/charts'''

# Fix charts response - add setCached
old_charts_json = '''  const chartsResult = { statusBreakdown, weeklySales: days, monthlySales: monthDays, adSourceBreakdown, total, weekComparison,
    _debug: { shippingFromOrders: [...chartsProcessedShippingInvoices].length, shippingFromManifests: chartsCountedManifests.size, totalRevenue: invoices.reduce((s,i)=>s+i.revenue,0) }
  });
});'''

new_charts_json = '''  const chartsResult = { statusBreakdown, weeklySales: days, monthlySales: monthDays, adSourceBreakdown, total, weekComparison,
    _debug: { shippingFromOrders: [...chartsProcessedShippingInvoices].length, shippingFromManifests: chartsCountedManifests.size, totalRevenue: invoices.reduce((s,i)=>s+i.revenue,0) }
  };
  setCached(chartsCacheKey, chartsResult, 10 * 60 * 1000); // 10 min cache
  res.json(chartsResult);
});'''

changed = 0

if old_si_json in content:
    content = content.replace(old_si_json, new_si_json, 1)
    changed += 1
    print("OK smart-insights: added setCached to response")
else:
    print("MISS smart-insights response block")
    idx = content.find("adAttribution: { bestSource")
    if idx >= 0:
        print(repr(content[idx-20:idx+200]))

if old_charts_json in content:
    content = content.replace(old_charts_json, new_charts_json, 1)
    changed += 1
    print("OK charts: added setCached to response")
else:
    print("MISS charts response block")
    idx = content.find("chartsResult = {")
    if idx >= 0:
        print(repr(content[idx-5:idx+300]))

if changed > 0:
    with open(analytics, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Saved {changed} more fixes")
