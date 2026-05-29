Add-Type -AssemblyName System.Drawing

$src = "c:\Users\Synko\Documents\chodza-app\assets\odznaky.png"
$outDir = "c:\Users\Synko\Documents\chodza-app\assets\badges"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$img = [System.Drawing.Bitmap]::FromFile($src)
$cols = 9
$rows = 6
$cellW = $img.Width / $cols
$cellH = $img.Height / $rows
$crop = 170

# col,row (0-indexed) -> nazov suboru
$items = @(
  @{ c = 0; r = 4; name = "step-shoe" },
  @{ c = 0; r = 1; name = "star" },
  @{ c = 2; r = 2; name = "club100" },
  @{ c = 1; r = 2; name = "club500" },
  @{ c = 0; r = 2; name = "club1000" },
  @{ c = 4; r = 0; name = "marathon" },
  @{ c = 0; r = 3; name = "week" },
  @{ c = 0; r = 0; name = "month" },
  @{ c = 4; r = 4; name = "endurance" }
)

foreach ($it in $items) {
  $sx = [int][Math]::Round($it.c * $cellW)
  $sy = [int][Math]::Round($it.r * $cellH)
  if ($sx + $crop -gt $img.Width) { $sx = $img.Width - $crop }
  if ($sy + $crop -gt $img.Height) { $sy = $img.Height - $crop }

  $full = New-Object System.Drawing.Bitmap($crop, $crop, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $minX = $crop; $minY = $crop; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $crop; $y++) {
    for ($x = 0; $x -lt $crop; $x++) {
      $px = $img.GetPixel($sx + $x, $sy + $y)
      $bright = [Math]::Max($px.R, [Math]::Max($px.G, $px.B))
      # jas -> alpha (cierne pozadie zmizne, kov zostane plny)
      $a = [int][Math]::Round([Math]::Min(255, $bright * 1.18))
      if ($a -lt 10) { $a = 0 }
      $full.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $px.R, $px.G, $px.B))
      if ($a -gt 24) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  # orez na obsah (odstrani priehladne okraje) -> ikona sa potom da vycentrovat
  if ($maxX -lt 0) { $minX = 0; $minY = 0; $maxX = $crop - 1; $maxY = $crop - 1 }
  $w = $maxX - $minX + 1
  $h = $maxY - $minY + 1
  $trim = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $trim.SetPixel($x, $y, $full.GetPixel($minX + $x, $minY + $y))
    }
  }
  $path = Join-Path $outDir ($it.name + ".png")
  $trim.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $trim.Dispose()
  $full.Dispose()
  Write-Output ("OK " + $it.name + " " + $w + "x" + $h)
}

$img.Dispose()
Write-Output "DONE"
