import re

path = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\dashboard.tsx"

with open(path, encoding="utf-8") as f:
    content = f.read()

# Fix 1: shippingFollowup
old1 = '  const { data: shippingFollowup = [] } = useQuery<any[]>({\n    queryKey: ["shipping-followup-dashboard"],\n    queryFn: analyticsApi.shippingFollowup,\n    staleTime: 60000,\n    refetchOnWindowFocus: true,\n    refetchInterval: 120000,\n  });'

new1 = '  const { data: shippingFollowup = [] } = useQuery<any[]>({\n    queryKey: ["shipping-followup-dashboard"],\n    queryFn: analyticsApi.shippingFollowup,\n    staleTime: 5 * 60_000,\n    gcTime: 10 * 60_000,\n    refetchOnWindowFocus: false,\n    refetchOnMount: false,\n    placeholderData: (prev) => prev,\n  });'

# Fix 2: cashRegisters
old2 = '  const { data: cashRegisters } = useQuery({\n    queryKey: ["cash-registers-list"],\n    queryFn: cashRegistersApi.list,\n    staleTime: 60000,\n    refetchOnWindowFocus: true,\n    refetchInterval: 120000,\n    enabled: canViewFinancials,\n  });'

new2 = '  const { data: cashRegisters } = useQuery({\n    queryKey: ["cash-registers-list"],\n    queryFn: cashRegistersApi.list,\n    staleTime: 5 * 60_000,\n    gcTime: 10 * 60_000,\n    refetchOnWindowFocus: false,\n    refetchOnMount: false,\n    placeholderData: (prev) => prev,\n    enabled: canViewFinancials,\n  });'

changed = 0

if old1 in content:
    content = content.replace(old1, new1, 1)
    changed += 1
    print("OK Fix 1 shippingFollowup applied")
else:
    print("MISS Fix 1 - searching...")
    idx = content.find("shipping-followup-dashboard")
    if idx >= 0:
        print(repr(content[idx-50:idx+350]))

if old2 in content:
    content = content.replace(old2, new2, 1)
    changed += 1
    print("OK Fix 2 cashRegisters applied")
else:
    print("MISS Fix 2 - searching...")
    idx = content.find("cash-registers-list")
    if idx >= 0:
        print(repr(content[idx-50:idx+350]))

if changed > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Saved {changed} fixes")
else:
    print("No changes")
