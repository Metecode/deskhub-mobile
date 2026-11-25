# What deskhub-mobile.cmd runs: sets everything up the first time, and starts what isn't running.
# It never changes the companion's files; its folder is remembered in
# %LOCALAPPDATA%\deskhub-mobile\launch.json.
[CmdletBinding()]
param(
    # Another folder instead of the Startup folder, to try this.
    [string]$StartupFolder = [Environment]::GetFolderPath('Startup'),
    # Without opening pages, to try this.
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:LOCALAPPDATA 'deskhub-mobile'
$memoryFile = Join-Path $data 'launch.json'
$page = Join-Path $data 'connect.html'
$envFile = Join-Path $root '.env'
$runner = Join-Path $PSScriptRoot 'run-companion.py'
$autostart = Join-Path $PSScriptRoot 'autostart.ps1'
Set-Location -LiteralPath $root

function Say([string]$Text, [string]$Color = 'Gray') { Write-Host $Text -ForegroundColor $Color }

function Confirm-Yes([string]$Question) {
    $answer = Read-Host "$Question [Y/n]"
    return ($answer -eq '' -or $answer -match '^\s*[yYeE]')
}

# ---- what is remembered

$memory = @{}
if (Test-Path -LiteralPath $memoryFile) {
    try {
        (Get-Content -Raw -LiteralPath $memoryFile | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $memory[$_.Name] = $_.Value }
    } catch { Say 'What was remembered could not be read, so it is asked again.' Yellow }
}

function Save-Memory {
    New-Item -ItemType Directory -Force -Path $data | Out-Null
    [IO.File]::WriteAllText($memoryFile, ($memory | ConvertTo-Json))
}

# ---- settings

function Read-Env {
    $values = @{}
    if (Test-Path -LiteralPath $envFile) {
        foreach ($line in Get-Content -LiteralPath $envFile -Encoding UTF8) {
            if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') { $values[$Matches[1]] = $Matches[2].Trim('"', "'") }
        }
    }
    return $values
}

# host and token under [hub] in the companion's config.toml.
function Read-Hub([string]$Folder) {
    $hub = @{}
    $section = ''
    foreach ($line in Get-Content -LiteralPath (Join-Path $Folder 'config.toml') -Encoding UTF8) {
        if ($line -match '^\s*\[+\s*([^\]]+?)\s*\]+') { $section = $Matches[1] }
        elseif ($section -eq 'hub' -and $line -match '^\s*(host|token)\s*=\s*["'']([^"'']*)["'']') { $hub[$Matches[1]] = $Matches[2] }
    }
    return $hub
}

function New-Token {
    $bytes = New-Object byte[] 16
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($bytes)
    $random.Dispose()
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function Test-CompanionFolder([string]$Folder) {
    return $Folder -and (Test-Path -LiteralPath (Join-Path $Folder 'config.toml')) -and
        (Test-Path -LiteralPath (Join-Path $Folder '.venv\Scripts\pythonw.exe'))
}

# The folder, or '' for none.
function Get-CompanionFolder {
    if ($memory.ContainsKey('companion')) {
        $known = [string]$memory.companion
        if ($known -eq '' -or (Test-CompanionFolder $known)) { return $known }
        Say "The companion is no longer in $known." Yellow
    }
    $parent = Split-Path -Parent $root
    $found = @('deskhub-companion', 'deskhub\companion') | ForEach-Object { Join-Path $parent $_ } |
        Where-Object { Test-CompanionFolder $_ } | Select-Object -First 1
    Say ''
    Say 'Where is the Desk Hub companion? (the folder with its config.toml and .venv)' White
    while ($true) {
        $hint = if ($found) { "Enter for $found, or - for none" } else { 'or - to go on without it' }
        $answer = (Read-Host "Folder ($hint)").Trim().Trim('"')
        if ($answer -eq '-') { $folder = ''; break }
        if ($answer -eq '' -and $found) { $folder = $found; break }
        if (Test-CompanionFolder $answer) { $folder = (Resolve-Path -LiteralPath $answer).Path; break }
        Say 'There is no config.toml with a .venv in there. Install the companion as its README says.' Yellow
    }
    $memory.companion = $folder
    Save-Memory
    return $folder
}

# ---- programs

function Test-Tools {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Node.js is not installed. Get it from https://nodejs.org (LTS), then start this again.' }
    $version = (& node -p 'process.versions.node').Split('.') | ForEach-Object { [int]$_ }
    $major, $minor = $version[0], $version[1]
    if (-not (($major -eq 20 -and $minor -ge 19) -or ($major -eq 22 -and $minor -ge 12) -or $major -ge 23)) {
        throw "Node.js $($version -join '.') is too old. Get the LTS from https://nodejs.org, then start this again."
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw 'pnpm is not installed. Run "npm install -g pnpm@10", then start this again.'
    }
}

function Get-Newest([string[]]$Paths) {
    $files = foreach ($path in $Paths) {
        if (Test-Path -LiteralPath $path) { Get-ChildItem -LiteralPath $path -Recurse -File }
    }
    return ($files | Measure-Object -Property LastWriteTimeUtc -Maximum).Maximum
}

function Get-Time([string]$Path) {
    if (Test-Path -LiteralPath $Path) { return (Get-Item -LiteralPath $Path).LastWriteTimeUtc }
    return [DateTime]::MinValue
}

function Get-BridgeHash {
    $file = Join-Path $root 'apps\bridge\dist\index.js'
    if (Test-Path -LiteralPath $file) { return (Get-FileHash -LiteralPath $file).Hash }
    return ''
}

# True if the bridge itself is another one now.
function Update-Build {
    $before = Get-BridgeHash
    if ((Get-Time 'pnpm-lock.yaml') -gt (Get-Time 'node_modules\.modules.yaml')) {
        Say 'Installing packages...' White
        & pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'The packages could not be installed.' }
        # pnpm leaves the file alone when there was nothing to do.
        (Get-Item -LiteralPath 'node_modules\.modules.yaml').LastWriteTimeUtc = [DateTime]::UtcNow
    }
    $sources = Get-Newest @('apps\bridge\src', 'apps\bridge\package.json', 'apps\web\src', 'apps\web\public', 'apps\web\index.html',
        'apps\web\package.json', 'apps\web\vite.config.ts', 'packages\protocol\src', 'pnpm-lock.yaml')
    $built = @((Get-Time 'apps\bridge\dist\index.js'), (Get-Time 'apps\web\dist\build.json')) | Sort-Object | Select-Object -First 1
    if ($sources -gt $built) {
        Say 'Building...' White
        & pnpm build
        if ($LASTEXITCODE -ne 0) { throw 'The build failed.' }
    }
    return ($before -ne '' -and $before -ne (Get-BridgeHash))
}

# ---- processes

function Get-BridgeProcess {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listener) { return $null }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
    if ($process -and $process.Name -eq 'node.exe') { return $process }
    throw "Port $port is taken by $($process.Name). Set another HUB_PORT in .env, or end it."
}

function Start-Bridge {
    $script = Join-Path $PSScriptRoot 'start-bridge.ps1'
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        if (Get-BridgeProcess) { return }
    }
    throw "The bridge did not start. See $(Join-Path $data 'bridge.log')."
}

function Stop-Bridge {
    $process = Get-BridgeProcess
    if (-not $process) { return }
    Stop-Process -Id $process.ProcessId -Force -Confirm:$false
    for ($i = 0; $i -lt 20 -and (Get-BridgeProcess); $i++) { Start-Sleep -Milliseconds 250 }
}

# The companion holds this while it runs, however it was started (single_instance() in its __main__.py).
function Test-Companion {
    $mutex = $null
    $running = [Threading.Mutex]::TryOpenExisting('Local\DeskHubCompanion', [ref]$mutex)
    if ($mutex) { $mutex.Dispose() }
    return $running
}

function Start-Companion {
    $python = Join-Path $companion '.venv\Scripts\pythonw.exe'
    $config = Join-Path $companion 'config.toml'
    Start-Process $python -WorkingDirectory $companion -ArgumentList "`"$runner`" --tray --config `"$config`""
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        if (Test-Companion) { return }
    }
    Say 'The companion did not start. See ~\.deskhub\companion.log.' Yellow
}

# Only one that was started through run-companion.py.
function Stop-Companion {
    Get-CimInstance Win32_Process -Filter "Name = 'pythonw.exe' OR Name = 'python.exe'" |
        Where-Object { $_.CommandLine -like '*run-companion.py*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue }
    for ($i = 0; $i -lt 20 -and (Test-Companion); $i++) { Start-Sleep -Milliseconds 250 }
    if (Test-Companion) { Say 'The companion was started in another way. Quit it with its tray icon.' Yellow }
}

# ---- the PC

function Test-Firewall {
    $rules = Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -ErrorAction SilentlyContinue
    # Windows makes Node's when it asks about it.
    return [bool]($rules | Where-Object { $_.DisplayName -eq 'deskhub-mobile' -or $_.DisplayName -like 'Node.js*' })
}

function Add-FirewallRule {
    $command = "New-NetFirewallRule -DisplayName 'deskhub-mobile' -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private -RemoteAddress LocalSubnet"
    try {
        Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList "-NoProfile -Command `"$command`""
    } catch { Say 'Windows did not allow it.' Yellow }
}

# The address on the network with the way out; a VPN's or a virtual machine's comes after it.
function Get-Address {
    $configs = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address }
    $best = $configs | Sort-Object { $_.NetIPv4Interface.InterfaceMetric } | Select-Object -First 1
    if ($best) { return @($best.IPv4Address)[0].IPAddress }
    return $null
}

function Test-Autostart { return Test-Path -LiteralPath (Join-Path $StartupFolder 'deskhub-mobile bridge.lnk') }

function Set-Autostart([bool]$On) {
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $autostart, $(if ($On) { 'install' } else { 'remove' }), '-StartupFolder', $StartupFolder)
    if ($On -and $companion) { $arguments += @('-Companion', $companion) }
    & powershell @arguments
}

function Show-Link {
    $address = Get-Address
    if (-not $address) { return Say 'This PC is on no network.' Yellow }
    New-Item -ItemType Directory -Force -Path $data | Out-Null
    & node (Join-Path $PSScriptRoot 'link-page.mjs') $page $port $address
    if ($LASTEXITCODE -ne 0) { return Say 'The QR code could not be made.' Yellow }
    if ($NoBrowser) { return Say "The page is $page" }
    Start-Process $page
    Say 'A page with a QR code is open in your browser.'
}

function Show-Status {
    $bridge = if (Get-BridgeProcess) { 'running' } else { 'stopped' }
    $state = if (Test-Companion) { 'running' } elseif ($companion) { 'stopped' } else { 'not set up here' }
    $sign = if (Test-Autostart) { 'starts by itself' } else { 'does not start by itself' }
    Say ''
    Say "  Bridge      $bridge (http://$(Get-Address):$port)" White
    Say "  Companion   $state" White
    Say "  At sign-in  $sign" White
    Say ''
}

# ---- what happens

try {
    Say 'deskhub-mobile' White
    Test-Tools
    $companion = Get-CompanionFolder

    $first = -not (Test-Path -LiteralPath $envFile)
    if ($first) {
        $hub = if ($companion) { Read-Hub $companion } else { @{} }
        # The companion's own token, so that its file can stay as it is.
        $hubToken = if ($hub.token -and $hub.token -ne 'change-me') { $hub.token } else { New-Token }
        $text = [IO.File]::ReadAllText((Join-Path $root '.env.example'))
        $text = $text -replace '(?m)^HUB_TOKEN=.*$', "HUB_TOKEN=$hubToken" -replace '(?m)^CLIENT_TOKEN=.*$', "CLIENT_TOKEN=$(New-Token)"
        [IO.File]::WriteAllText($envFile, $text)
        Say 'Made .env with new tokens. The place for the weather goes in there (WEATHER_...).'
    }
    $settings = Read-Env
    $port = if ($settings.HUB_PORT) { [int]$settings.HUB_PORT } else { 8765 }

    if ($companion) {
        $hub = Read-Hub $companion
        if ($hub.host -ne "127.0.0.1:$port" -or $hub.token -ne $settings.HUB_TOKEN) {
            Say ''
            Say "The companion does not know this bridge yet. Under [hub] in its config.toml, set:" Yellow
            Say "  host = `"127.0.0.1:$port`"" White
            Say '  token = "..."   (the HUB_TOKEN in .env)' White
            if (Confirm-Yes 'Open both files now?') {
                Start-Process notepad $envFile
                Start-Process notepad (Join-Path $companion 'config.toml')
                Read-Host 'Save config.toml, then press Enter' | Out-Null
            }
        }
    }

    if (Update-Build) {
        Say 'The bridge is a new one, so it is restarted.'
        Stop-Bridge
    }
    if (-not (Get-BridgeProcess)) { Start-Bridge }
    if ($companion -and -not (Test-Companion)) { Start-Companion }

    if (-not $memory.ContainsKey('askedFirewall') -and -not (Test-Firewall)) {
        if (Confirm-Yes 'The phone must get through the firewall. Add a rule? (asks for administrator rights)') { Add-FirewallRule }
        $memory.askedFirewall = $true
        Save-Memory
    }
    if (-not $memory.ContainsKey('askedAutostart') -and -not (Test-Autostart)) {
        if (Confirm-Yes 'Start by itself when you sign in to Windows?') { Set-Autostart $true }
        $memory.askedAutostart = $true
        Save-Memory
    }
    if (-not $memory.ContainsKey('shownLink')) {
        Show-Link
        $memory.shownLink = $true
        Save-Memory
    }

    while ($true) {
        Show-Status
        $choice = (Read-Host 'Q: QR code for a phone   R: restart   S: stop   A: sign-in on/off   Enter: close').Trim().ToUpperInvariant()
        switch ($choice) {
            'Q' { Show-Link }
            'R' {
                Stop-Bridge
                Start-Bridge
                if ($companion) {
                    Stop-Companion
                    if (-not (Test-Companion)) { Start-Companion }
                }
            }
            'S' {
                Stop-Bridge
                if ($companion) { Stop-Companion }
            }
            'A' { Set-Autostart (-not (Test-Autostart)) }
        }
        if ($choice -eq '') { break }
    }
} catch {
    Say "Error: $($_.Exception.Message)" Red
    exit 1
} finally {
    # It has the token in it.
    if (Test-Path -LiteralPath $page) { Remove-Item -LiteralPath $page -Confirm:$false }
}
