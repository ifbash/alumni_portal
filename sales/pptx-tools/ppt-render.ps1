param([string]$File, [string]$OutDir, [string]$Prefix = 'slide', [string]$Only = '')
# Renders slides of an existing deck to PNG with PowerPoint. One process; quits it unless it was already open.
$ErrorActionPreference = 'Stop'
$wasRunning = [bool](Get-Process POWERPNT -ErrorAction SilentlyContinue)
$app = New-Object -ComObject PowerPoint.Application
$app.DisplayAlerts = 1
$pres = $null
try {
  New-Item -ItemType Directory -Force $OutDir | Out-Null
  $pres = $app.Presentations.Open($File, -1, 0, 0)
  $want = @(); if ($Only) { $want = $Only.Split(',') | ForEach-Object { [int]$_ } }
  for ($i = 1; $i -le $pres.Slides.Count; $i++) {
    if ($want.Count -gt 0 -and -not ($want -contains $i)) { continue }
    $f = Join-Path $OutDir ('{0}-{1:D2}.png' -f $Prefix, $i)
    $pres.Slides.Item($i).Export($f, 'PNG', 1920, 1080)
    Write-Output $f
  }
  $pres.Close(); $pres = $null
} finally {
  if ($pres) { try { $pres.Close() } catch {} }
  if (-not $wasRunning) { try { $app.Quit() } catch {} }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  [GC]::Collect()
}
