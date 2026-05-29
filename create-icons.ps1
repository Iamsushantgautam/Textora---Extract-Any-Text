Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$dir   = 'D:\My Project\Chrome extension\copy all readable text from any website\icons'

if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

foreach ($sz in $sizes) {

    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # ── Rounded blue background ──────────────────────────────────────────────
    $bgColor = [System.Drawing.Color]::FromArgb(255, 79, 110, 247)
    $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
    $r       = [int]($sz * 0.18)
    $path    = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0,          0,          ($r*2), ($r*2), 180, 90)
    $path.AddArc(($sz-$r*2), 0,          ($r*2), ($r*2), 270, 90)
    $path.AddArc(($sz-$r*2), ($sz-$r*2), ($r*2), ($r*2),   0, 90)
    $path.AddArc(0,          ($sz-$r*2), ($r*2), ($r*2),  90, 90)
    $path.CloseFigure()
    $g.FillPath($bgBrush, $path)

    # ── Magnifying glass (white) ─────────────────────────────────────────────
    $lw     = [float]([Math]::Max(1.5, $sz * 0.07))
    $white  = [System.Drawing.Color]::White
    $pen    = New-Object System.Drawing.Pen($white, $lw)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round

    $cx     = [float]($sz * 0.42)
    $cy     = [float]($sz * 0.42)
    $rad    = [float]($sz * 0.255)
    $g.DrawEllipse($pen, ($cx - $rad), ($cy - $rad), ($rad * 2), ($rad * 2))

    # Handle
    $angle  = [double]([Math]::PI * 0.78)
    $hx1    = [float]($cx + [Math]::Cos($angle) * $rad)
    $hy1    = [float]($cy + [Math]::Sin($angle) * $rad)
    $hLen   = [float]($sz * 0.21)
    $hx2    = [float]($hx1 + [Math]::Cos($angle) * $hLen)
    $hy2    = [float]($hy1 + [Math]::Sin($angle) * $hLen)
    $penH   = New-Object System.Drawing.Pen($white, ($lw * 1.15))
    $penH.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $penH.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($penH, $hx1, $hy1, $hx2, $hy2)

    # Text lines inside lens (only for sizes >= 32)
    if ($sz -ge 32) {
        $lineH   = [float]([Math]::Max(1.2, $sz * 0.038))
        $spacing = [float]($sz * 0.085)
        $ws      = @(($rad * 1.1), ($rad * 0.8), ($rad * 0.52))
        $ops     = @(255, 190, 115)
        for ($i = 0; $i -lt 3; $i++) {
            $lx  = [float]($cx - $ws[$i] / 2)
            $ly  = [float]($cy - $spacing + $i * $spacing - $lineH / 2)
            $lb  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($ops[$i], 255, 255, 255))
            $g.FillRectangle($lb, $lx, $ly, $ws[$i], $lineH)
            $lb.Dispose()
        }
    }

    $g.Dispose()
    $outPath = Join-Path $dir "icon${sz}.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $outPath"
}

Write-Host "Done! All 4 icons created in icons/ folder."
