# Generate a simple 1024x1024 source icon for Tauri
Add-Type -AssemblyName System.Drawing

# Create 1024x1024 bitmap
$bitmap = New-Object System.Drawing.Bitmap(1024, 1024)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Fill with a gradient background
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(1024, 1024)),
    [System.Drawing.Color]::FromArgb(255, 67, 97, 238),  # Blue
    [System.Drawing.Color]::FromArgb(255, 88, 166, 255)  # Lighter blue
)
$graphics.FillRectangle($brush, 0, 0, 1024, 1024)

# Draw a simple "A" for ArcSign
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$font = New-Object System.Drawing.Font("Arial", 600, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString("A", $font, $textBrush, 512, 512, $format)

# Save as PNG
$bitmap.Save("app-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()
$brush.Dispose()
$textBrush.Dispose()
$font.Dispose()
$format.Dispose()

Write-Host "Generated app-icon.png (1024x1024)" -ForegroundColor Green
