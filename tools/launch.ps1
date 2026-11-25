# What the user reads is Turkish; Windows PowerShell 5.1 needs the byte order mark for that.
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
    $answer = Read-Host "$Question [E/h]"
    return ($answer -eq '' -or $answer -match '^\s*[yYeE]')
}

# ---- what is remembered

$memory = @{}
if (Test-Path -LiteralPath $memoryFile) {
    try {
        (Get-Content -Raw -LiteralPath $memoryFile | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $memory[$_.Name] = $_.Value }
    } catch { Say 'Hatırlanan ayarlar okunamadı, yeniden soruluyor.' Yellow }
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
        Say "Companion artık $known klasöründe değil." Yellow
    }
    $parent = Split-Path -Parent $root
    $found = @('deskhub-companion', 'deskhub\companion') | ForEach-Object { Join-Path $parent $_ } |
        Where-Object { Test-CompanionFolder $_ } | Select-Object -First 1
    Say ''
    Say 'Desk Hub companion nerede? (config.toml ve .venv bulunan klasör)' White
    while ($true) {
        $hint = if ($found) { "$found için Enter, companion yoksa -" } else { 'companion yoksa -' }
        $answer = (Read-Host "Klasör ($hint)").Trim().Trim('"')
        if ($answer -eq '-') { $folder = ''; break }
        if ($answer -eq '' -and $found) { $folder = $found; break }
        if (Test-CompanionFolder $answer) { $folder = (Resolve-Path -LiteralPath $answer).Path; break }
        Say 'O klasörde config.toml ve .venv yok. Companion’ı kendi README’sine göre kur.' Yellow
    }
    $memory.companion = $folder
    Save-Memory
    return $folder
}

# ---- programs

function Test-Tools {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Node.js kurulu değil. https://nodejs.org adresinden LTS sürümünü kur, sonra yeniden başlat.' }
    $version = (& node -p 'process.versions.node').Split('.') | ForEach-Object { [int]$_ }
    $major, $minor = $version[0], $version[1]
    if (-not (($major -eq 20 -and $minor -ge 19) -or ($major -eq 22 -and $minor -ge 12) -or $major -ge 23)) {
        throw "Node.js $($version -join '.') çok eski. https://nodejs.org adresinden LTS sürümünü kur, sonra yeniden başlat."
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw 'pnpm kurulu değil. "npm install -g pnpm@10" çalıştır, sonra yeniden başlat.'
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
        Say 'Paketler kuruluyor...' White
        # Not part of what this function returns.
        & pnpm install --frozen-lockfile | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'Paketler kurulamadı.' }
        # pnpm leaves the file alone when there was nothing to do.
        (Get-Item -LiteralPath 'node_modules\.modules.yaml').LastWriteTimeUtc = [DateTime]::UtcNow
    }
    $sources = Get-Newest @('apps\bridge\src', 'apps\bridge\package.json', 'apps\web\src', 'apps\web\public', 'apps\web\index.html',
        'apps\web\package.json', 'apps\web\vite.config.ts', 'packages\protocol\src', 'pnpm-lock.yaml')
    $built = @((Get-Time 'apps\bridge\dist\index.js'), (Get-Time 'apps\web\dist\build.json')) | Sort-Object | Select-Object -First 1
    if ($sources -gt $built) {
        Say 'Derleniyor...' White
        & pnpm build | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'Derleme başarısız oldu.' }
    }
    return ($before -ne '' -and $before -ne (Get-BridgeHash))
}

# ---- processes

function Get-BridgeProcess {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listener) { return $null }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
    if ($process -and $process.Name -eq 'node.exe') { return $process }
    throw "$port portunu $($process.Name) kullanıyor. .env içinde başka bir HUB_PORT ver ya da onu kapat."
}

function Start-Bridge {
    $script = Join-Path $PSScriptRoot 'start-bridge.ps1'
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        if (Get-BridgeProcess) { return }
    }
    throw "Bridge başlamadı. Nedeni: $(Join-Path $data 'bridge.log')"
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
    Say 'Companion başlamadı. Nedeni: ~\.deskhub\companion.log' Yellow
}

# Only one that was started through run-companion.py.
function Stop-Companion {
    Get-CimInstance Win32_Process -Filter "Name = 'pythonw.exe' OR Name = 'python.exe'" |
        Where-Object { $_.CommandLine -like '*run-companion.py*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue }
    for ($i = 0; $i -lt 20 -and (Test-Companion); $i++) { Start-Sleep -Milliseconds 250 }
    if (Test-Companion) { Say 'Companion başka bir yolla başlatılmış. Saatin yanındaki simgesinden kapat.' Yellow }
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
    } catch { Say 'Windows izin vermedi.' Yellow }
}

# The address on the network with the way out; a VPN's or a virtual machine's comes after it. (Get-NetIPConfiguration
# takes seconds.)
function Get-Address {
    $adapters = [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
        Where-Object { $_.OperationalStatus -eq 'Up' -and $_.NetworkInterfaceType -notin 'Loopback', 'Tunnel' }
    foreach ($kind in @('Ethernet|GigabitEthernet|Wireless80211', '.')) {
        foreach ($adapter in $adapters) {
            if ($adapter.NetworkInterfaceType.ToString() -notmatch $kind) { continue }
            $properties = $adapter.GetIPProperties()
            $out = $properties.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' -and $_.Address.ToString() -ne '0.0.0.0' }
            $own = $properties.UnicastAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1
            if ($out -and $own) { return $own.Address.ToString() }
        }
    }
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
    if (-not $address) { return Say 'Bu PC bir ağa bağlı değil.' Yellow }
    New-Item -ItemType Directory -Force -Path $data | Out-Null
    & node (Join-Path $PSScriptRoot 'link-page.mjs') $page $port $address
    if ($LASTEXITCODE -ne 0) { return Say 'QR kod oluşturulamadı.' Yellow }
    if ($NoBrowser) { return Say "Sayfa: $page" }
    Start-Process $page
    Say 'QR kodlu sayfa tarayıcıda açıldı.'
}

function Show-Status {
    $bridge = if (Get-BridgeProcess) { 'çalışıyor' } else { 'durdu' }
    $state = if (Test-Companion) { 'çalışıyor' } elseif ($companion) { 'durdu' } else { 'ayarlanmadı' }
    $sign = if (Test-Autostart) { 'kendiliğinden başlar' } else { 'kendiliğinden başlamaz' }
    Say ''
    Say "  Bridge       $bridge (http://$(Get-Address):$port)" White
    Say "  Companion    $state" White
    Say "  Oturum açma  $sign" White
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
        Say '.env yeni anahtarlarla oluşturuldu. Hava için konum da oraya yazılır (WEATHER_...).'
    }
    $settings = Read-Env
    $port = if ($settings.HUB_PORT) { [int]$settings.HUB_PORT } else { 8765 }

    if ($companion) {
        $hub = Read-Hub $companion
        if ($hub.host -ne "127.0.0.1:$port" -or $hub.token -ne $settings.HUB_TOKEN) {
            Say ''
            Say "Companion bu bridge’i henüz tanımıyor. config.toml içinde [hub] altına şunları yaz:" Yellow
            Say "  host = `"127.0.0.1:$port`"" White
            Say '  token = "..."   (.env içindeki HUB_TOKEN)' White
            if (Confirm-Yes 'İki dosya şimdi açılsın mı?') {
                Start-Process notepad $envFile
                Start-Process notepad (Join-Path $companion 'config.toml')
                Read-Host 'config.toml dosyasını kaydet, sonra Enter’a bas' | Out-Null
            }
        }
    }

    if (Update-Build) {
        Say 'Bridge yenilendi, yeniden başlatılıyor.'
        Stop-Bridge
    }
    if (-not (Get-BridgeProcess)) { Start-Bridge }
    if ($companion -and -not (Test-Companion)) { Start-Companion }

    # Looking through the rules takes seconds, so it is done once.
    if (-not $memory.ContainsKey('askedFirewall')) {
        if (-not (Test-Firewall) -and (Confirm-Yes 'Telefonun bağlanması için güvenlik duvarına kural eklensin mi? (yönetici izni ister)')) { Add-FirewallRule }
        $memory.askedFirewall = $true
        Save-Memory
    }
    if (-not $memory.ContainsKey('askedAutostart') -and -not (Test-Autostart)) {
        if (Confirm-Yes 'Windows oturumu açılınca kendiliğinden başlasın mı?') { Set-Autostart $true }
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
        $choice = (Read-Host 'Q: telefon için QR kod   Y: yeniden başlat   D: durdur   O: oturumla başlama aç/kapat   Enter: kapat').Trim().ToUpperInvariant()
        switch ($choice) {
            'Q' { Show-Link }
            'Y' {
                Stop-Bridge
                Start-Bridge
                if ($companion) {
                    Stop-Companion
                    if (-not (Test-Companion)) { Start-Companion }
                }
            }
            'D' {
                Stop-Bridge
                if ($companion) { Stop-Companion }
            }
            'O' { Set-Autostart (-not (Test-Autostart)) }
        }
        if ($choice -eq '') { break }
    }
} catch {
    Say "Hata: $($_.Exception.Message)" Red
    exit 1
} finally {
    # It has the token in it.
    if (Test-Path -LiteralPath $page) { Remove-Item -LiteralPath $page -Confirm:$false }
}
