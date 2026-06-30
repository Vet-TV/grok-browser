Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(10, 10, 15))

$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(232, 168, 56)), 12
$g.DrawEllipse($pen, 40, 40, 176, 176)

$pen2 = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(232, 168, 56)), 10
$g.DrawLine($pen2, 88, 128, 168, 128)
$g.DrawLine($pen2, 128, 88, 128, 168)

$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(29, 155, 240))
$g.FillEllipse($brush, 116, 116, 24, 24)

$outDir = Join-Path $PSScriptRoot "..\resources"
$pngPath = Join-Path $outDir "icon.png"
$icoPath = Join-Path $outDir "icon.ico"

$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Create multi-size ICO
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$fs = [System.IO.File]::Create($icoPath)
$icon.Save($fs)
$fs.Close()

$g.Dispose()
$bmp.Dispose()
$pen.Dispose()
$pen2.Dispose()
$brush.Dispose()

Write-Host "Generated $pngPath and $icoPath"