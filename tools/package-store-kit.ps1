$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$version = (Get-Content -LiteralPath (Join-Path $projectPath 'manifest.json') -Raw | ConvertFrom-Json).version
$files = @('README.md','CHANGELOG.md','PRIVACY.md','STORE_PRIVACY_FIELDS.md','THIRD_PARTY_NOTICES.md','LICENSE','store/listing-description.txt','store/README.md','store/github-release-notes.md',
    'icons/icon16.png','icons/icon32.png','icons/icon48.png','icons/icon128.png','store/UPLOAD_STEPS.md','store/SCREENSHOTS.md','store/screenshot-crops.json')
$files += Get-ChildItem -LiteralPath (Join-Path $projectPath 'store/assets') -File -Filter '*.png' | ForEach-Object { 'store/assets/' + $_.Name }
$files += Get-ChildItem -LiteralPath (Join-Path $projectPath 'store/references') -File -Filter '*.png' | ForEach-Object { 'store/references/' + $_.Name }
$files += Get-ChildItem -LiteralPath (Join-Path $projectPath 'store/screenshots') -File -Filter '*.png' | ForEach-Object { 'store/screenshots/' + $_.Name }
$files += Get-ChildItem -LiteralPath (Join-Path $projectPath 'store/screenshot-alternates') -File -Filter '*.png' | ForEach-Object { 'store/screenshot-alternates/' + $_.Name }
$files += Get-ChildItem -LiteralPath (Join-Path $projectPath 'docs') -Filter '*.md' | ForEach-Object { 'docs/' + $_.Name }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$output = Join-Path $projectPath ('dist/chrome-web-store-kit-' + $version + '.zip')
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($output)) | Out-Null
$archive = [System.IO.Compression.ZipArchive]::new([System.IO.File]::Create($output), [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectPath $file), $file) | Out-Null }
} finally { $archive.Dispose() }
Write-Output "Submission kit: $output"
$screenshotFiles = @(Get-ChildItem -LiteralPath (Join-Path $projectPath 'store/screenshots') -File -Filter '*.png' | Sort-Object Name)
if ($screenshotFiles.Count -ne 5) { throw 'Expected exactly five selected listing screenshots.' }
$screenshotOutput = Join-Path $projectPath ('dist/store-screenshots-' + $version + '.zip')
$screenshots = [System.IO.Compression.ZipArchive]::new([System.IO.File]::Create($screenshotOutput), [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $screenshotFiles) { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($screenshots, $file.FullName, $file.Name) | Out-Null }
} finally { $screenshots.Dispose() }
Write-Output "Five listing screenshots: $screenshotOutput"
