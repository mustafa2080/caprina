import sys
sys.stdout.reconfigure(encoding='utf-8')

team_path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx'
team = open(team_path, encoding='utf-8').read()
lines = team.split('\n')

# IIFE content from EmployeeDetail (1-indexed lines 3582-4374 = 0-indexed 3581-4373)
iife_lines = lines[3581:4374]

# Convert: remove 12 leading spaces, replace ratingCfgLocal with ratingCfg
converted = []
for l in iife_lines:
    if l.startswith('            '):
        l = l[12:]
    l = l.replace('ratingCfgLocal', 'ratingCfg')
    converted.append(l)

body = '\n'.join(converted)

# Split at return (
ret_idx = body.find('\nreturn (')
if ret_idx == -1:
    ret_idx = body.find('return (')

vars_part = body[:ret_idx].strip()
jsx_part = body[ret_idx:].strip()

# Remove "return (" prefix and ");" suffix
jsx_inner = jsx_part
if jsx_inner.startswith('return ('):
    jsx_inner = jsx_inner[len('return ('):].strip()
if jsx_inner.endswith(');'):
    jsx_inner = jsx_inner[:-2].strip()

# Indent by 2 spaces
def indent2(s):
    return '\n'.join('  ' + l if l.strip() else '' for l in s.split('\n'))

vars_indented = indent2(vars_part)
jsx_indented = indent2(jsx_inner)

component = (
    "// --- KPI Tab Content (reusable) ---\n"
    "function KpiTabContent({\n"
    "  profileId,\n"
    "  kpis,\n"
    "  report,\n"
    "  fullProfile,\n"
    "  salaryReport: _sr,\n"
    "  ratingCfg,\n"
    "  kpiViewMode,\n"
    "  kpiSelectedDate,\n"
    "  reportMonth,\n"
    "  isAdmin,\n"
    "  isSuperAdmin,\n"
    "  setEditingKpi,\n"
    "  setKpiDialogOpen,\n"
    "  deleteKpi,\n"
    "  displayName,\n"
    "}: {\n"
    "  profileId: number;\n"
    "  kpis: EmployeeKpi[];\n"
    "  report: any;\n"
    "  fullProfile: any;\n"
    "  salaryReport?: any;\n"
    "  ratingCfg: any;\n"
    '  kpiViewMode: "monthly" | "daily";\n'
    "  kpiSelectedDate: string;\n"
    "  reportMonth: string;\n"
    "  isAdmin: boolean;\n"
    "  isSuperAdmin: boolean;\n"
    "  setEditingKpi: (k: EmployeeKpi) => void;\n"
    "  setKpiDialogOpen: (v: boolean) => void;\n"
    "  deleteKpi: (id: number) => void;\n"
    "  displayName: string;\n"
    "}) {\n"
    + vars_indented + "\n"
    "  return (\n"
    + jsx_indented + "\n"
    "  );\n"
    "}\n\n"
)

print(f"Component length: {len(component)} chars")
print("--- First 400 ---")
print(component[:400])
print("--- Last 300 ---")
print(component[-300:])
