$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$version = (Get-Content -LiteralPath (Join-Path $projectPath 'manifest.json') -Raw | ConvertFrom-Json).version
$files = @('README.md','CHANGELOG.md','PRIVACY.md','STORE_PRIVACY_FIELDS.md','THIRD_PARTY_NOTICES.md','LICENSE','store-listing-description.txt','store/README.md','store/github-release-notes.md',
    'icons/icon16.png','icons/icon32.png','icons/icon48.png','icons/icon128.png',
    'store/assets/drawing-studio-1280x800.png','store/assets/word-search-1280x800.png','store/assets/ai-setup-1280x800.png','store/assets/promo-440x280.png')
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
