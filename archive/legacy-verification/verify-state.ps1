$base = 'c:\Users\Joshua\OneDrive\Desktop\resqfood\RESQFOODFINAL'
$out  = Join-Path $base 'STATE7.txt'
$L = New-Object System.Collections.Generic.List[string]

$core = @{}
Get-ChildItem (Join-Path $base 'public/js/core') -Filter *.js | ForEach-Object {
    $core[$_.Name] = (Get-Content $_.FullName -Raw)
}

$mods = @{
    'adminUsers'    = 'admin/users.html'
    'adminDonations'= 'admin/donations.html'
    'adminAudit'    = 'admin/audit.html'
    'orgHistory'    = 'org-admin/history.html'
    'activeMission' = 'volunteer/active-mission.html'
}

$importRe = [regex]'(?m)^import\s*\{([^}]+)\}\s*from\s*[''"]([^''"]+)[''"]'
$idRe     = [regex]"getElementById\(\s*['""]([^'""]+)['""]"

foreach ($m in $mods.Keys) {
    $mp = Join-Path $base ("public/js/modules/{0}.js" -f $m)
    $mc = Get-Content $mp -Raw

    foreach ($im in $importRe.Matches($mc)) {
        $syms = $im.Groups[1].Value -split ',' | ForEach-Object { $_.Trim() }
        $src  = $im.Groups[2].Value
        $file = Split-Path $src -Leaf
        $hay  = $core[$file]
        if (-not $hay) { $hay = (Get-Content (Join-Path $base ("public/js/{0}" -f $src)) -Raw -ErrorAction SilentlyContinue) }
        foreach ($s in $syms) {
            if (-not $s) { continue }
            $pat = "export\s+(async\s+)?(function|const|let|class)\s+{0}\b" -f $s
            $pat2 = "export\s*\{[^}]*\b{0}\b" -f $s
            $ok = ($hay -match $pat) -or ($hay -match $pat2)
            if (-not $ok) { $L.Add(("IMPORT-MISS {0}: {1} from {2}" -f $m, $s, $file)) }
        }
    }

    $hp = Join-Path $base ("public/{0}" -f $mods[$m])
    $hc = Get-Content $hp -Raw
    foreach ($dm in $idRe.Matches($mc)) {
        $id = $dm.Groups[1].Value
        $idpat = "id=`"{0}`"" -f $id
        if ($hc -notmatch $idpat) { $L.Add(("DOMID-MISS {0}: #{1} not in {2}" -f $m, $id, $mods[$m])) }
    }
}

if ($L.Count -eq 0) { $L.Add('ALL CLEAR: imports resolve + DOM ids present') }
$L | Set-Content $out -Encoding utf8
Write-Output 'DONE'
