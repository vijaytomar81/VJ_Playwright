# ============================================================
# PLAYWRIGHT FRAMEWORK - WINDOWS ENVIRONMENT SETUP
# ============================================================
#
# Purpose:
#   Prepare a new corporate Windows machine for running
#   the Playwright TypeScript automation framework.
#
# Requirements:
#   - Windows PowerShell 5.1 or PowerShell 7+
#   - Node.js installed (version supporting NODE_USE_SYSTEM_CA)
#   - npm installed
#   - package.json available
#   - package-lock.json available
#
# Usage:
#   powershell.exe -NoProfile -File .\scripts\windows\setup-playwright.ps1
#
# ============================================================

# Stop execution when a PowerShell command fails
$ErrorActionPreference = "Stop"

# ============================================================
# FUNCTION: Validate command execution
# ============================================================

function Assert-CommandSuccess {

    param(
        [string]$Step
    )

    if ($LASTEXITCODE -ne 0) {

        throw "$Step failed with exit code $LASTEXITCODE"

    }
}


try {

    Write-Host ""
    Write-Host "================================================="
    Write-Host " PLAYWRIGHT FRAMEWORK - WINDOWS SETUP"
    Write-Host "================================================="
    Write-Host ""


    # ========================================================
    # STEP 1 - DETECT PROJECT ROOT
    # ========================================================

    Write-Host "[1/8] Detecting project directory..."

    $projectRoot = (
        Resolve-Path (
            Join-Path $PSScriptRoot "..\.."
        )
    ).Path

    Set-Location $projectRoot

    Write-Host "Project root: $projectRoot"


    # ========================================================
    # STEP 2 - ENABLE WINDOWS CORPORATE CERTIFICATES
    # ========================================================

    Write-Host ""
    Write-Host "[2/8] Enabling Windows corporate certificates..."

    $env:NODE_USE_SYSTEM_CA = "1"

    Write-Host "NODE_USE_SYSTEM_CA enabled."


    # ========================================================
    # STEP 3 - VERIFY NODE.JS AND NPM
    # ========================================================

    Write-Host ""
    Write-Host "[3/8] Verifying Node.js and npm..."

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {

        throw "Node.js is not installed or is missing from PATH."

    }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {

        throw "npm is not installed or is missing from PATH."

    }

    Write-Host "Node.js version:"
    node --version

    Assert-CommandSuccess "Node.js verification"

    Write-Host "npm version:"
    npm --version

    Assert-CommandSuccess "npm verification"


    # ========================================================
    # STEP 4 - DETECT CORPORATE PROXY
    # ========================================================

    Write-Host ""
    Write-Host "[4/8] Detecting corporate proxy..."

    # Destination used by Playwright browser downloads
    $targetUrl = [Uri]"https://cdn.playwright.dev/"

    # Read Windows system proxy configuration
    $systemProxy = [System.Net.WebRequest]::GetSystemWebProxy()

    # Resolve the proxy for Playwright's download server
    $proxyAddress = $systemProxy.GetProxy($targetUrl)

    $isDirect = $systemProxy.IsBypassed($targetUrl)

    Write-Host "Target: $targetUrl"
    Write-Host "Selected proxy: $proxyAddress"
    Write-Host "Direct connection: $isDirect"


    # ========================================================
    # STEP 5 - CONFIGURE HTTP_PROXY AND HTTPS_PROXY
    # ========================================================

    Write-Host ""
    Write-Host "[5/8] Configuring network environment..."

    if (
        -not $isDirect -and
        $proxyAddress.AbsoluteUri -ne $targetUrl.AbsoluteUri
    ) {

        $env:HTTP_PROXY = $proxyAddress.AbsoluteUri

        $env:HTTPS_PROXY = $proxyAddress.AbsoluteUri

        Write-Host "Corporate proxy configured successfully."

        Write-Host "HTTP_PROXY  = $env:HTTP_PROXY"
        Write-Host "HTTPS_PROXY = $env:HTTPS_PROXY"

    }
    else {

        Write-Host "Windows selected a direct connection."

        Write-Warning "No corporate proxy was configured automatically."

    }

    # Increase Playwright download timeout
    $env:PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT = "120000"

    Write-Host "Download timeout configured: 120000 ms"


    # ========================================================
    # STEP 6 - VERIFY PACKAGE FILES
    # ========================================================

    Write-Host ""
    Write-Host "[6/8] Checking package files..."

    if (-not (Test-Path ".\package.json")) {

        throw "package.json was not found in the project root."

    }

    if (-not (Test-Path ".\package-lock.json")) {

        throw "package-lock.json was not found in the project root."

    }

    Write-Host "package.json found."
    Write-Host "package-lock.json found."


    # ========================================================
    # STEP 7 - INSTALL ALL PROJECT DEPENDENCIES
    # ========================================================

    Write-Host ""
    Write-Host "[7/8] Installing project dependencies..."

    Write-Host ""
    Write-Host "Running npm ci..."
    Write-Host ""

    # npm ci:
    #   - Reads package.json
    #   - Reads package-lock.json
    #   - Removes existing node_modules
    #   - Installs locked dependency versions
    #   - Installs development dependencies
    #   - Does not modify the lockfile

    npm ci --include=dev

    Assert-CommandSuccess "npm dependency installation"

    Write-Host ""
    Write-Host "All npm dependencies installed successfully."


    # ========================================================
    # STEP 8 - VERIFY PLAYWRIGHT AND INSTALL CHROMIUM
    # ========================================================

    Write-Host ""
    Write-Host "[8/8] Verifying Playwright installation..."

    Write-Host ""
    Write-Host "Playwright version:"

    npx --no-install playwright --version

    Assert-CommandSuccess "Playwright verification"

    Write-Host ""
    Write-Host "Installing Playwright Chromium..."
    Write-Host ""

    npx --no-install playwright install chromium

    Assert-CommandSuccess "Chromium installation"


    # ========================================================
    # SETUP COMPLETED
    # ========================================================

    Write-Host ""
    Write-Host "================================================="
    Write-Host " PLAYWRIGHT FRAMEWORK SETUP COMPLETED"
    Write-Host "================================================="
    Write-Host ""

    Write-Host "Node.js:             OK"
    Write-Host "npm:                 OK"
    Write-Host "Corporate CA:        ENABLED"
    Write-Host "Proxy configuration: CHECKED"
    Write-Host "Project dependencies: INSTALLED"
    Write-Host "Playwright:          VERIFIED"
    Write-Host "Chromium:            INSTALLED"

    Write-Host ""
    Write-Host "Your Playwright framework is ready."
    Write-Host ""

}
catch {

    Write-Host ""
    Write-Host "================================================="
    Write-Host " PLAYWRIGHT FRAMEWORK SETUP FAILED"
    Write-Host "================================================="
    Write-Host ""

    Write-Host "Error: $($_.Exception.Message)"

    exit 1

}