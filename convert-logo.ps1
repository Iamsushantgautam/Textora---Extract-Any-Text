Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName WindowsBase

$filePath = "D:\My Project\Chrome extension\copy all readable text from any website\icons\logo.png"
$outDir = "D:\My Project\Chrome extension\copy all readable text from any website\icons"
$sizes = @(16, 32, 48, 128)

if ([System.IO.File]::Exists($filePath)) {
    try {
        # Open source file stream
        $stream = [System.IO.File]::OpenRead($filePath)
        $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create($stream, [System.Windows.Media.Imaging.BitmapCreateOptions]::None, [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
        $sourceFrame = $decoder.Frames[0]
        $stream.Close()

        # Crop to the centered square of the logo (964x964 starting at X=144, Y=124)
        $cropRect = New-Object System.Windows.Int32Rect(144, 124, 964, 964)
        $cropped = New-Object System.Windows.Media.Imaging.CroppedBitmap($sourceFrame, $cropRect)

        foreach ($size in $sizes) {
            # Create a target Visual and DrawingContext to scale the image
            $visual = New-Object System.Windows.Media.DrawingVisual
            $context = $visual.RenderOpen()
            
            # Create a rounded rectangle clipping geometry
            # This clips away the white corners of the logo outside its rounded rectangle boundary
            $clip = New-Object System.Windows.Media.RectangleGeometry
            
            # We add a small inset to clip slightly inside the border, preventing white edge artifacts
            $inset = $size * 0.035
            $clipSize = $size - (2 * $inset)
            $clipRect = New-Object System.Windows.Rect($inset, $inset, $clipSize, $clipSize)
            $clip.Rect = $clipRect
            
            # Logo rounded corner radius matching the brand
            $clip.RadiusX = $clipSize * 0.20
            $clip.RadiusY = $clipSize * 0.20
            
            $context.PushClip($clip)
            
            # Draw the cropped logo to fill the entire square
            $drawRect = New-Object System.Windows.Rect(0, 0, $size, $size)
            $context.DrawImage($cropped, $drawRect)
            
            $context.Pop()
            $context.Close()
            
            # Create RenderTargetBitmap
            $rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap($size, $size, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
            $rtb.Render($visual)
            
            # Encode to PNG
            $pngEncoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
            $bitmapFrame = [System.Windows.Media.Imaging.BitmapFrame]::Create($rtb)
            $pngEncoder.Frames.Add($bitmapFrame) | Out-Null
            
            $outPath = Join-Path $outDir "icon$size.png"
            $outStream = [System.IO.File]::Create($outPath)
            $pngEncoder.Save($outStream)
            $outStream.Close()
            
            Write-Host "Successfully generated icon$size.png at size ${size}x${size}"
        }
    } catch {
        Write-Host "Error converting logo to icons: $_"
        if ($stream) { $stream.Close() }
        if ($outStream) { $outStream.Close() }
    }
} else {
    Write-Host "Error: logo.png not found at $filePath"
}
