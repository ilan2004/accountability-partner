# WhatsApp Auth Setup Script for Railway
# This script prepares your WhatsApp authentication files for Railway deployment

param(
    [string]$AuthPath = ".\auth\accountability-bot",
    [string]$ServiceName = "worker"
)

Write-Host "🔧 Setting up WhatsApp authentication for Railway deployment..." -ForegroundColor Green

# Check if auth directory exists
if (!(Test-Path $AuthPath)) {
    Write-Error "Auth directory not found: $AuthPath"
    Write-Host "Please ensure you have WhatsApp authentication files in: $AuthPath" -ForegroundColor Yellow
    Write-Host "Run the local WhatsApp setup first to generate these files." -ForegroundColor Yellow
    exit 1
}

# Check if auth files exist
$authFiles = Get-ChildItem -Path $AuthPath -File
if ($authFiles.Count -eq 0) {
    Write-Error "No authentication files found in: $AuthPath"
    Write-Host "Please run the local WhatsApp setup to generate authentication files." -ForegroundColor Yellow
    exit 1
}

Write-Host "Found $($authFiles.Count) auth files:" -ForegroundColor Cyan
$authFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }

try {
    # Step 1: Create zip archive
    Write-Host "`n📦 Creating auth file archive..." -ForegroundColor Blue
    $zipPath = ".\wa-auth.zip"
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }
    
    Compress-Archive -Path "$AuthPath\*" -DestinationPath $zipPath -Force
    Write-Host "✅ Created: $zipPath" -ForegroundColor Green

    # Step 2: Convert to base64
    Write-Host "`n🔐 Converting to base64..." -ForegroundColor Blue
    $base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($zipPath))
    $base64File = ".\wa-auth.b64.txt"
    Set-Content -Path $base64File -Value $base64
    Write-Host "✅ Created: $base64File" -ForegroundColor Green

    # Step 3: Set Railway environment variables
    Write-Host "`n🚀 Setting Railway environment variables..." -ForegroundColor Blue
    
    # Check if Railway CLI is available
    try {
        $railwayVersion = railway --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "Railway CLI not found"
        }
        Write-Host "Using Railway CLI: $railwayVersion" -ForegroundColor Gray
    } catch {
        Write-Error "Railway CLI not found. Please install it first:"
        Write-Host "npm install -g @railway/cli" -ForegroundColor Yellow
        Write-Host "railway login" -ForegroundColor Yellow
        Write-Host "railway link" -ForegroundColor Yellow
        exit 1
    }

    # Set environment variables
    Write-Host "Setting AUTH_ZIP_B64..." -ForegroundColor Cyan
    $env:TEMP_AUTH_B64 = $base64
    railway variables set "AUTH_ZIP_B64=$base64" --service $ServiceName
    
    Write-Host "Setting WA_AUTH_PATH..." -ForegroundColor Cyan
    railway variables set "WA_AUTH_PATH=/app/auth" --service $ServiceName
    
    Write-Host "Setting WA_SESSION_NAME..." -ForegroundColor Cyan
    railway variables set "WA_SESSION_NAME=accountability-bot" --service $ServiceName

    # Get WhatsApp group JID from user
    Write-Host "`n📱 WhatsApp Group Configuration" -ForegroundColor Blue
    Write-Host "You need to set the WhatsApp group JID where notifications will be sent."
    Write-Host "Format: 1234567890123456@g.us"
    $groupJid = Read-Host "Enter your WhatsApp Group JID (or press Enter to skip)"
    
    if ($groupJid -and $groupJid.Trim() -ne "") {
        Write-Host "Setting WA_GROUP_JID..." -ForegroundColor Cyan
        railway variables set "WA_GROUP_JID=$groupJid" --service $ServiceName
    } else {
        Write-Host "⚠️ Skipped WA_GROUP_JID. You can set it later in Railway dashboard." -ForegroundColor Yellow
    }

    Write-Host "✅ Environment variables set successfully!" -ForegroundColor Green

    # Step 4: Deploy
    Write-Host "`n🚢 Deploying to Railway..." -ForegroundColor Blue
    railway up --service $ServiceName

    Write-Host "`n✅ Setup complete!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Blue
    Write-Host "1. Check Railway logs to verify WhatsApp connection:" -ForegroundColor White
    Write-Host "   railway logs --service $ServiceName --follow" -ForegroundColor Gray
    Write-Host "2. After successful connection, remove AUTH_ZIP_B64 for security:" -ForegroundColor White
    Write-Host "   railway variables unset AUTH_ZIP_B64 --service $ServiceName" -ForegroundColor Gray
    Write-Host "3. The auth files are now persisted in Railway volume at /app/auth" -ForegroundColor White

} catch {
    Write-Error "Setup failed: $_"
    Write-Host "Please check the error and try again." -ForegroundColor Yellow
    exit 1
} finally {
    # Cleanup temporary files
    if (Test-Path ".\wa-auth.zip") {
        Remove-Item ".\wa-auth.zip" -Force
        Write-Host "🧹 Cleaned up wa-auth.zip" -ForegroundColor Gray
    }
    if (Test-Path ".\wa-auth.b64.txt") {
        Write-Host "📄 Keeping wa-auth.b64.txt for reference (contains base64 data)" -ForegroundColor Gray
        Write-Host "   You can delete this file after successful deployment." -ForegroundColor Gray
    }
}

Write-Host "`n🎉 WhatsApp auth setup complete!" -ForegroundColor Green
