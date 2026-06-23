# One-off: wrap the DBYD table in the Service Location template with a docxtemplater
# inverse section so it can be skipped when DBYD is supplied by the client, and add the
# note that shows in that case. Run from the repo root:  & scripts\wrap-dbyd.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$path = (Resolve-Path 'public\templates\service-location.docx').Path
$zip = [System.IO.Compression.ZipFile]::Open($path, 'Update')
try {
    $entry = $zip.GetEntry('word/document.xml')
    $rs = $entry.Open()
    $sr = New-Object System.IO.StreamReader($rs, [System.Text.Encoding]::UTF8)
    $xml = $sr.ReadToEnd()
    $sr.Dispose(); $rs.Dispose()

    if ($xml.Contains('{^dbydByClient}')) {
        Write-Output 'already-wrapped'
    } else {
        $dStart = $xml.IndexOf('{dbydjobno}')
        $dEnd = $xml.IndexOf('{plansupply}')
        $tblStart = $xml.LastIndexOf('<w:tbl>', $dStart)
        $tblEndIdx = $xml.IndexOf('</w:tbl>', $dEnd)
        if ($dStart -ge 0 -and $tblStart -ge 0 -and $tblEndIdx -ge 0) {
            $end = $tblEndIdx + 8
            $before = '<w:p><w:r><w:t>{^dbydByClient}</w:t></w:r></w:p>'
            $after = '<w:p><w:r><w:t>{/dbydByClient}</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{#dbydByClient}DBYD to be supplied by client{/dbydByClient}</w:t></w:r></w:p>'
            $xml = $xml.Substring(0, $tblStart) + $before + $xml.Substring($tblStart, $end - $tblStart) + $after + $xml.Substring($end)
            $ws = $entry.Open(); $ws.SetLength(0)
            $enc = New-Object System.Text.UTF8Encoding($false)
            $sw = New-Object System.IO.StreamWriter($ws, $enc)
            $sw.Write($xml); $sw.Dispose(); $ws.Dispose()
            Write-Output ("wrapped dStart=$dStart tblStart=$tblStart end=$end")
        } else {
            Write-Output ("anchors-not-found dStart=$dStart tblStart=$tblStart tblEndIdx=$tblEndIdx")
        }
    }
} finally {
    $zip.Dispose()
}

# Dump document.xml for verification.
$zip2 = [System.IO.Compression.ZipFile]::OpenRead($path)
$e2 = $zip2.GetEntry('word/document.xml')
$r2 = $e2.Open(); $sr2 = New-Object System.IO.StreamReader($r2)
[System.IO.File]::WriteAllText((Join-Path (Get-Location) 'scripts\_doc.xml'), $sr2.ReadToEnd())
$sr2.Dispose(); $r2.Dispose(); $zip2.Dispose()
Write-Output 'dumped'
