path = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\inventory.tsx"

with open(path, encoding="utf-8") as f:
    content = f.read()

# Fix products query in inventory
old1 = '  const { data: products, isLoading } = useQuery({ queryKey: ["products"], queryFn: productsApi.list, staleTime: 0, refetchOnWindowFocus: true });'
new1 = '  const { data: products, isLoading } = useQuery({ queryKey: ["products"], queryFn: productsApi.list, staleTime: 2 * 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, refetchOnMount: false, placeholderData: (prev) => prev });'

# Fix variants query
old2 = '  const { data: allVariants } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll, staleTime: 0, refetchOnWindowFocus: true });'
new2 = '  const { data: allVariants } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll, staleTime: 2 * 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, refetchOnMount: false, placeholderData: (prev) => prev });'

# Fix warehouses query
old3 = '  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list, staleTime: 0, refetchOnWindowFocus: true });'
new3 = '  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list, staleTime: 10 * 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false, refetchOnMount: false });'

changed = 0
for old, new, name in [(old1, new1, "products"), (old2, new2, "variants"), (old3, new3, "warehouses")]:
    if old in content:
        content = content.replace(old, new, 1)
        changed += 1
        print(f"OK Fixed {name}")
    else:
        print(f"MISS {name} not found")

if changed > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Saved {changed} fixes to inventory.tsx")
