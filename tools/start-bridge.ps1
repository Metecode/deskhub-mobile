# What autostart.ps1's shortcut runs: the bridge, with its output in a log file.
$bridge = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\bridge'
$logs = Join-Path $env:LOCALAPPDATA 'deskhub-mobile'
$log = Join-Path $logs 'bridge.log'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
# The last run's log is kept.
if (Test-Path -LiteralPath $log) { Move-Item -Force -LiteralPath $log -Destination "$log.old" }

# The links have the token in them, which doesn't belong in a log. cmd.exe writes what node writes,
# without PowerShell's own encoding.
Set-Location -LiteralPath $bridge
$env:DESKHUB_LOG = $log
cmd.exe /d /c 'node dist\index.js --no-links > "%DESKHUB_LOG%" 2>&1'
exit $LASTEXITCODE
