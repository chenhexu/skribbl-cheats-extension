param([Parameter(Mandatory=$true)][string]$Archive)
$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$archivePath = (Resolve-Path -LiteralPath $Archive).Path
$modelPath = [System.IO.Path]::GetFullPath((Join-Path $projectPath 'browser-ai/models'))
$manifest = Get-Content -LiteralPath (Join-Path $modelPath 'manifest.json') -Raw | ConvertFrom-Json
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    # Validate every expected entry before writing anything. Paths come from
    # the checked-in manifest, never from untrusted ZIP entry enumeration.
    foreach ($property in $manifest.files.PSObject.Properties) {
        if ($property.Name -notmatch '^[a-zA-Z0-9_.-]+(/[a-zA-Z0-9_.-]+)*$' -or $property.Name.Split('/') -contains '..') { throw 'Unsafe model path' }
        $entry = $zip.GetEntry('browser-ai/models/' + $property.Name)
        if (-not $entry -or $entry.Length -ne $property.Value.bytes) { throw "Missing or incompatible model asset: $($property.Name)" }
        $stream = $entry.Open()
        $hasher = [System.Security.Cryptography.SHA256]::Create()
        try { $hash = [System.BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
        finally { $hasher.Dispose(); $stream.Dispose() }
        if ($hash -ne $property.Value.sha256) { throw "Model hash mismatch: $($property.Name)" }
    }
    foreach ($property in $manifest.files.PSObject.Properties) {
        $destination = [System.IO.Path]::GetFullPath((Join-Path $modelPath $property.Name))
        if (-not $destination.StartsWith($modelPath + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Model path escapes project' }
        [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination)) | Out-Null
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($zip.GetEntry('browser-ai/models/' + $property.Name), $destination, $true)
    }
} finally { $zip.Dispose() }
Write-Output 'Browser model assets restored and verified against the checked-in SHA256 manifest.'
