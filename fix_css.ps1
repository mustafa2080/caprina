Set-Location $PSScriptRoot
$f = Resolve-Path '.\artifacts\caprina\src\pages\shipping-manifest.tsx'
$c = Get-Content $f -Raw -Encoding UTF8

# 1. Add state for Excel import dialog
$stateOld = 'const [showAddOrdersDialog, setShowAddOrdersDialog] = useState(false);'
if ($c.Contains($stateOld)) {
    $stateNew = 'const [showAddOrdersDialog, setShowAddOrdersDialog] = useState(false);' + "`n" + '  const [showExcelImportDialog, setShowExcelImportDialog] = useState(false);'
    $c = $c.Replace($stateOld, $stateNew)
    Write-Host "State added"
} else {
    Write-Host "State target not found"
}

# 2. Add ExcelImportDialog render - find the Add Orders Dialog comment (ASCII only search)
# The Add Orders dialog starts with: {showAddOrdersDialog && manifest && (
$dialogOld = '{showAddOrdersDialog && manifest && ('
$dialogIdx = $c.IndexOf($dialogOld)
Write-Host "Add Orders dialog at: $dialogIdx"

if ($dialogIdx -ge 0 -and -not $c.Contains('showExcelImportDialog && manifest')) {
    $excelDialog = @"
      {showExcelImportDialog && manifest && !isLocked && (
        <ExcelImportDialog
          manifest={manifest}
          onClose={() => setShowExcelImportDialog(false)}
          onImported={refetch}
        />
      )}

      
"@
    $c = $c.Substring(0, $dialogIdx) + $excelDialog + $c.Substring($dialogIdx)
    Write-Host "Excel dialog render added"
} else {
    Write-Host "Already patched or not found"
}

[System.IO.StreamWriter]$sw = [System.IO.StreamWriter]::new($f.ToString(), $false, [System.Text.Encoding]::UTF8)
$sw.Write($c)
$sw.Close()
Write-Host "Done. Length: $($c.Length)"
