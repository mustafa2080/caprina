
$file = 'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts'
$lines = [System.IO.File]::ReadAllLines($file, [System.Text.Encoding]::UTF8)
$newLines = [System.Collections.Generic.List[string]]::new($lines)

# Find the line with "const kpiCountMap"
$kpiCountLine = -1
for ($i = 0; $i -lt $newLines.Count; $i++) {
    if ($newLines[$i] -match '^\s+const kpiCountMap: Record<number, number> = \{\};$') {
        $kpiCountLine = $i
        break
    }
}
Write-Host "kpiCountMap at line: $kpiCountLine"
if ($kpiCountLine -ge 0) {
    # Insert kpisByProfile declaration after kpiCountMap
    $newLines.Insert($kpiCountLine + 1, '  const kpisByProfile: Record<number, any[]> = {};')
    Write-Host "Inserted kpisByProfile declaration"
}

[System.IO.File]::WriteAllLines($file, $newLines.ToArray(), [System.Text.Encoding]::UTF8)
Write-Host "Done. Lines: $($newLines.Count)"
