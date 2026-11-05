param([switch]$BrowserTests)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ($env:OS -ne "Windows_NT") {
    throw "Esta distribucion debe compilarse desde Windows, no desde WSL."
}

foreach ($tool in @("node", "npm.cmd", "cargo", "rustc")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Falta $tool. Instala Node.js, Rust MSVC y Visual Studio Build Tools con C++ y Windows SDK. Consulta README.md."
    }
}

$rustInfo = & rustc -vV
if ($LASTEXITCODE -ne 0 -or -not ($rustInfo -match "host: .*windows-msvc")) {
    throw "Selecciona la toolchain Rust de Windows MSVC. No uses la toolchain de WSL o GNU."
}

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program $($Arguments -join ' ') fallo con codigo $LASTEXITCODE. No se publica el paquete."
    }
}

Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    # npm ci installs the Windows-specific Tauri bindings, even after working in WSL.
    Invoke-Checked "npm.cmd" @("ci")
    Invoke-Checked "npm.cmd" @("run", "build")
    Invoke-Checked "cargo" @("fmt", "--check")
    Invoke-Checked "cargo" @("test", "--locked", "--features", "desktop")
    Invoke-Checked "cargo" @("clippy", "--locked", "--all-targets", "--features", "desktop", "--", "-D", "warnings")
    Invoke-Checked "npm.cmd" @("test")
    if ($BrowserTests) {
        Invoke-Checked "npx.cmd" @("playwright", "install", "chromium")
        Invoke-Checked "npm.cmd" @("run", "test:e2e")
    }
    # First separator belongs to npm; second forwards --locked through Tauri to Cargo.
    Invoke-Checked "npm.cmd" @("run", "desktop:build", "--", "--", "--locked")

    $installers = @(Get-ChildItem "target/release/bundle/nsis/*-setup.exe" -ErrorAction Stop)
    if ($installers.Count -eq 0) { throw "La compilacion no genero un instalador NSIS." }
    foreach ($installer in $installers) {
        $hash = Get-FileHash $installer.FullName -Algorithm SHA256
        Write-Host "Instalador: $($installer.FullName)"
        Write-Host "SHA256: $($hash.Hash)"
    }
    Write-Host "Ejecutable: $((Resolve-Path 'target/release/rust_file_explorer_v1.exe').Path)"
    Write-Host "Paquete sin firma digital. Verifica instalacion, acceso directo y busqueda antes de distribuirlo."
} finally {
    Pop-Location
}
