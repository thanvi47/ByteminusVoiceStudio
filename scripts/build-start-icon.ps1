# Rebuild the launcher icon using Windows drawing APIs; no extra packages.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$studioRoot = Split-Path -Parent $PSScriptRoot
$bitmap = New-Object Drawing.Bitmap 1024,1024
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = 'AntiAlias'
$graphics.ScaleTransform(4,4)
function Fill-Rounded($x, $y, $size, $radius, $color) {
    $shape = New-Object Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $shape.AddArc($x,$y,$diameter,$diameter,180,90)
    $shape.AddArc(($x+$size-$diameter),$y,$diameter,$diameter,270,90)
    $shape.AddArc(($x+$size-$diameter),($y+$size-$diameter),$diameter,$diameter,0,90)
    $shape.AddArc($x,($y+$size-$diameter),$diameter,$diameter,90,90)
    $shape.CloseFigure()
    $brush = New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml($color))
    $graphics.FillPath($brush,$shape)
    $brush.Dispose(); $shape.Dispose()
}
Fill-Rounded 8 8 240 58 '#171126'
Fill-Rounded 17 17 222 50 '#7c3aed'
$pen = New-Object Drawing.Pen ([Drawing.ColorTranslator]::FromHtml('#f5efff')),12
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'
$graphics.DrawLine($pen,47,104,47,152)
$graphics.DrawLine($pen,73,77,73,179)
$graphics.DrawLine($pen,99,96,99,160)
$dark = New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#171126'))
$green = New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#40e6a1'))
$ink = New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#10281e'))
$graphics.FillEllipse($dark,105,88,122,122)
$graphics.FillEllipse($green,115,98,102,102)
$graphics.FillPolygon($ink,[Drawing.Point[]]@((New-Object Drawing.Point 153,122),(New-Object Drawing.Point 190,149),(New-Object Drawing.Point 153,176)))
$graphics.Dispose(); $pen.Dispose(); $dark.Dispose(); $green.Dispose(); $ink.Dispose()
$sizes = @(16,32,48,64,128,256)
$frames = @()
foreach ($size in $sizes) {
    $small = $bitmap.GetThumbnailImage($size,$size,$null,[IntPtr]::Zero)
    $stream = New-Object IO.MemoryStream
    $small.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
    $frames += ,$stream.ToArray()
    $small.Dispose(); $stream.Dispose()
}
$bitmap.Dispose()
$output = [IO.File]::Create((Join-Path $studioRoot 'public/studio-start.ico'))
$writer = New-Object IO.BinaryWriter $output
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i=0; $i -lt $sizes.Count; $i++) {
    $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
    $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
    $offset += $frames[$i].Length
}
foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
$writer.Dispose(); $output.Dispose()
