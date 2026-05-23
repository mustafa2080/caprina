$filePath = "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\components\layout.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

$oldBlock = @'
          {/* ── First Logo ── */}
          <div
            className="w-full flex items-center justify-center overflow-hidden"
            style={{
              background: "#0a0a0a",
              borderBottom: "2px solid hsl(var(--primary)/0.5)",
              boxShadow: "0 4px 24px hsl(var(--primary)/0.2)",
              maxHeight: "130px",
            }}
          >
            <img
              src={firstLogoBase64}
              alt="Caprina Logo"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                maxHeight: "130px",
                objectFit: "contain",
                filter: "drop-shadow(0 0 12px hsl(var(--primary)/0.4))",
              }}
            />
          </div>
'@

$newBlock = @'
          {/* ── First Logo ── */}
          <div
            className="w-full flex items-center justify-center"
            style={{
              background: "linear-gradient(180deg, #0d0d0d 0%, #111 100%)",
              borderBottom: "1px solid hsl(var(--primary)/0.35)",
              padding: "14px 20px",
              position: "relative",
            }}
          >
            <div style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse 80% 70% at 50% 50%, hsl(var(--primary)/0.12) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <img
              src={firstLogoBase64}
              alt="Caprina Logo"
              style={{
                display: "block",
                width: "auto",
                height: "auto",
                maxWidth: "160px",
                maxHeight: "110px",
                objectFit: "contain",
                position: "relative",
                zIndex: 1,
                filter: "drop-shadow(0 0 16px hsl(var(--primary)/0.55)) drop-shadow(0 2px 8px rgba(0,0,0,0.8))",
              }}
            />
          </div>
'@

if ($content.Contains("overflow-hidden")) {
    $newContent = $content.Replace($oldBlock, $newBlock)
    Set-Content $filePath -Value $newContent -Encoding UTF8 -NoNewline
    Write-Host "SUCCESS: Logo block updated"
} else {
    Write-Host "ERROR: old block not found"
}
