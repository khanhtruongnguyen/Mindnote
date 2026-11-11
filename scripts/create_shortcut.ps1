Add-Type -AssemblyName System.Drawing

$projectDir = Split-Path -Parent $PSScriptRoot
if (-not $projectDir) {
    $projectDir = "C:\Users\ADMIN\Downloads\MAP"
}

$imgPath = Join-Path $projectDir "public\icon-512.png"
$icoPath = Join-Path $projectDir "public\icon.ico"
$desktopPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)
$shortcutPath = Join-Path $desktopPath "Mindnote.lnk"

# 1. Tao file icon.ico neu chua co hoac cap nhat
Write-Host "[*] Dang tao file icon .ico tu icon-512.png..."
$sizes = @(256, 128, 64, 48, 32, 16)
$pngStreams = @()

$orig = [System.Drawing.Image]::FromFile($imgPath)

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($orig, 0, 0, $s, $s)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $pngStreams += ,@($s, $ms.ToArray())
    $ms.Dispose()
}
$orig.Dispose()

$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)

$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$sizes.Count)

$offset = 6 + 16 * $sizes.Count

foreach ($item in $pngStreams) {
    $s = $item[0]
    $bytes = $item[1]
    $w = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $h = if ($s -ge 256) { [byte]0 } else { [byte]$s }

    $bw.Write($w)
    $bw.Write($h)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]32)
    $bw.Write([UInt32]$bytes.Length)
    $bw.Write([UInt32]$offset)

    $offset += $bytes.Length
}

foreach ($item in $pngStreams) {
    $bytes = $item[1]
    $bw.Write($bytes)
}

$bw.Close()
$fs.Close()
Write-Host "[+] Da tao thanh cong file icon tai: $icoPath"

# 2. Tao shortcut ngoai Desktop
Write-Host "[*] Dang tao Shortcut ngoai Desktop..."
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)

$moDesktopVbs = Join-Path $projectDir "Mo-Desktop.vbs"
$electronExe = Join-Path $projectDir "node_modules\electron\dist\electron.exe"

# Uu tien chay truc tiep electron.exe (la ung dung GUI goc Windows, khong he hien cua so CMD)
if (Test-Path $electronExe) {
    $shortcut.TargetPath = $electronExe
    $shortcut.Arguments = "."
} elseif (Test-Path $moDesktopVbs) {
    $shortcut.TargetPath = "wscript.exe"
    $shortcut.Arguments = "`"$moDesktopVbs`""
} else {
    $shortcut.TargetPath = Join-Path $projectDir "Chay-Desktop.bat"
}

$shortcut.WorkingDirectory = $projectDir
$shortcut.IconLocation = "$icoPath,0"
$shortcut.Description = "Mindnote - Khong Gian Ghi Chu Vo Tan"
$shortcut.Save()

Write-Host "[+] Da tao shortcut thanh cong: $shortcutPath"
Write-Host "    - Target: $($shortcut.TargetPath) $($shortcut.Arguments)"
Write-Host "    - Working Directory: $($shortcut.WorkingDirectory)"
Write-Host "    - Icon: $($shortcut.IconLocation)"
