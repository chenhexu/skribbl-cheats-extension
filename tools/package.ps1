$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'package-validation.ps1')
& node (Join-Path $projectPath 'tools/build-browser-ai.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Browser AI build failed' }
$files = @('manifest.json','background.js','plan-transport.js','drawing-engine.js','drawer-studio.js','drawer.js','guess-delivery.js','word-search.js','content.js','socket-hook.js','page-hook.js',
    'dev-line-art/studio.html','dev-line-art/studio.css','dev-line-art/studio-page.js',
    'dev-line-art/index.html','dev-line-art/pipeline.js','dev-line-art/gcode.js','dev-line-art/legacy-viewer.js',
    'icons/icon16.png','icons/icon32.png','icons/icon48.png','icons/icon128.png','PRIVACY.md','THIRD_PARTY_NOTICES.md','LICENSE',
    'ai-setup.html','ai-setup.css','ai-setup.js','browser-ai/bridge.js','browser-ai/offscreen.html','browser-ai/offscreen.js','browser-ai/worker.js',
    'browser-ai/runtime/ort-wasm-simd-threaded.jsep.mjs','browser-ai/runtime/ort-wasm-simd-threaded.jsep.wasm','browser-ai/runtime/LICENSE.onnxruntime','browser-ai/runtime/LICENSE.transformers',
    'browser-ai/models/model-index.json','browser-ai/models/words.onnx','browser-ai/models/subject.onnx','browser-ai/models/lines.onnx','browser-ai/models/public-words.json','browser-ai/models/public-vectors.bin',
    'browser-ai/models/word-search/config.json','browser-ai/models/word-search/tokenizer.json','browser-ai/models/word-search/tokenizer_config.json','browser-ai/models/word-search/special_tokens_map.json',
    'browser-ai/models/LICENSE.minilm','browser-ai/models/LICENSE.u2net','browser-ai/models/LICENSE.informative-drawings')
Assert-SingleExtensionManifest $files
$modelManifest = Get-Content -LiteralPath (Join-Path $projectPath 'browser-ai/models/model-index.json') -Raw | ConvertFrom-Json
function Get-AssetSHA256([string]$assetPath) {
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    $assetStream = [System.IO.File]::OpenRead($assetPath)
    try { return [System.BitConverter]::ToString($hasher.ComputeHash($assetStream)).Replace('-','').ToLowerInvariant() }
    finally { $assetStream.Dispose(); $hasher.Dispose() }
}
foreach ($entry in $modelManifest.files.PSObject.Properties) {
    $relative = 'browser-ai/models/' + $entry.Name
    if ($relative -notin $files) { throw "Unexpected model asset: $relative" }
    if ((Get-AssetSHA256 (Join-Path $projectPath $relative)) -ne $entry.Value.sha256) { throw "Model asset changed: $relative. Re-export the models first." }
}
$manifest = Get-Content -LiteralPath (Join-Path $projectPath 'manifest.json') -Raw | ConvertFrom-Json
$references = @($manifest.background.service_worker)
foreach ($entry in $manifest.icons.PSObject.Properties) { $references += $entry.Value }
foreach ($entry in $manifest.content_scripts) { $references += @($entry.js) }
foreach ($entry in $manifest.web_accessible_resources) { $references += @($entry.resources) }
foreach ($reference in $references) {
    if ($reference -notin $files) { throw "Manifest reference absent from package allowlist: $reference" }
}
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectPath $file) -PathType Leaf)) { throw "Missing package file: $file" }
    if ($file.EndsWith('.js')) {
        & node --check (Join-Path $projectPath $file)
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $file" }
    }
}
$outputPath = Join-Path $projectPath 'dist'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$archivePath = Join-Path $outputPath ('skribbl-auto-guesser-' + $manifest.version + '.zip')
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Create($archivePath)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectPath $file), $file.Replace('\','/')) | Out-Null }
} finally { $archive.Dispose() }
$verificationArchive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try { Assert-SingleExtensionManifest @($verificationArchive.Entries | ForEach-Object { $_.FullName }) }
finally { $verificationArchive.Dispose() }
$revision = & git -C $projectPath rev-parse HEAD
$dirty = [bool](& git -C $projectPath status --porcelain --untracked-files=no)
$algorithm = [System.Security.Cryptography.SHA256]::Create()
$inputStream = [System.IO.File]::OpenRead($archivePath)
try { $hash = [System.BitConverter]::ToString($algorithm.ComputeHash($inputStream)).Replace('-','') }
finally { $inputStream.Dispose(); $algorithm.Dispose() }
[pscustomobject]@{Version=$manifest.version;SourceRevision=$revision;WorkingTreeModified=$dirty;SHA256=$hash;Files=$files} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath ($archivePath+'.json') -Encoding utf8
Write-Output "Package: $archivePath"
Write-Output "SHA256: $hash"
