# What the user reads is Turkish; Windows PowerShell 5.1 needs the byte order mark for that.
#
# Starts the bridge, and on request the companion, when you sign in to Windows.
#
#   powershell -ExecutionPolicy Bypass -File tools\autostart.ps1 install
#   powershell -ExecutionPolicy Bypass -File tools\autostart.ps1 install -Companion ..\deskhub\companion
#   powershell -ExecutionPolicy Bypass -File tools\autostart.ps1 status
#   powershell -ExecutionPolicy Bypass -File tools\autostart.ps1 remove
#
# It puts shortcuts in your Startup folder, which runs when you sign in. No administrator rights are
# needed. It only ever touches its own two shortcuts. -Companion is the folder with the companion's
# config.toml and .venv; it is started through run-companion.py, with its tray icon. Its log is
# ~\.deskhub\companion.log; the bridge's is %LOCALAPPDATA%\deskhub-mobile\bridge.log.
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('install', 'remove', 'status')]
    [string]$Action = 'status',
    # The companion's folder.
    [string]$Companion,
    # Another folder instead of the Startup folder, to try this.
    [string]$StartupFolder = [Environment]::GetFolderPath('Startup')
)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$bridgeLink = Join-Path $StartupFolder 'deskhub-mobile bridge.lnk'
$companionLink = Join-Path $StartupFolder 'deskhub-mobile companion.lnk'
# Of the companion's own deskhub-install (install_startup.py).
$upstreamLink = Join-Path $StartupFolder 'Desk Hub companion.lnk'

function Save-Shortcut([string]$Path, [string]$Target, [string]$Arguments, [string]$Folder, [string]$Description) {
    $link = (New-Object -ComObject WScript.Shell).CreateShortcut($Path)
    $link.TargetPath = $Target
    $link.Arguments = $Arguments
    $link.WorkingDirectory = $Folder
    $link.Description = $Description
    # Minimized; the window then hides itself.
    $link.WindowStyle = 7
    $link.Save()
}

function Show-Status {
    foreach ($entry in @(@('bridge', $bridgeLink), @('companion', $companionLink))) {
        $state = if (Test-Path -LiteralPath $entry[1]) { 'oturum açılınca başlar' } else { 'ayarlanmadı' }
        Write-Output ('{0,-10} {1}' -f $entry[0], $state)
    }
    if (Test-Path -LiteralPath $upstreamLink) {
        Write-Output "deskhub-install kısayolu da duruyor (Türkçe harfleri yine siler)."
    }
}

function Install-Autostart {
    if (-not (Test-Path -LiteralPath (Join-Path $root 'apps\bridge\dist\index.js'))) {
        throw 'Bridge derlenmemiş. Önce "pnpm build" çalıştır.'
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node bulunamadı.' }

    # Everything is checked before anything is written.
    if ($Companion) {
        if (Test-Path -LiteralPath $upstreamLink) {
            throw "Companion’ı deskhub-install kısayolu zaten başlatıyor. Önce onu kaldır: uv run deskhub-install --remove"
        }
        $folder = (Resolve-Path -LiteralPath $Companion).Path
        $python = Join-Path $folder '.venv\Scripts\pythonw.exe'
        $config = Join-Path $folder 'config.toml'
        foreach ($file in $python, $config) {
            if (-not (Test-Path -LiteralPath $file)) { throw "$file bulunamadı." }
        }
    }

    $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $script = Join-Path $PSScriptRoot 'start-bridge.ps1'
    Save-Shortcut $bridgeLink $powershell "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`"" $root 'deskhub-mobile bridge'
    if ($Companion) {
        $runner = Join-Path $PSScriptRoot 'run-companion.py'
        Save-Shortcut $companionLink $python "`"$runner`" --tray --config `"$config`"" $folder 'Desk Hub companion for deskhub-mobile'
    }
}

function Remove-Autostart {
    foreach ($link in $bridgeLink, $companionLink) {
        if (Test-Path -LiteralPath $link) { Remove-Item -LiteralPath $link -Confirm:$false }
    }
}

try {
    if ($Action -eq 'install') { Install-Autostart }
    if ($Action -eq 'remove') { Remove-Autostart }
    Show-Status
} catch {
    Write-Output "Hata: $($_.Exception.Message)"
    exit 1
}
