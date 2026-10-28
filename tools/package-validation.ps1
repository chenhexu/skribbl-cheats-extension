function Assert-SingleExtensionManifest([string[]]$Paths) {
    $manifests = @($Paths | Where-Object { ($_ -replace '\\','/').Split('/')[-1] -ieq 'manifest.json' })
    if ($manifests.Count -ne 1 -or $manifests[0] -cne 'manifest.json') {
        throw "Package must contain exactly one manifest.json, at its root. Found: $($manifests -join ', ')"
    }
}
