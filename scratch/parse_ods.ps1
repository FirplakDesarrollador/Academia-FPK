
$path = "Calificaciones/Bienvenida/temp_ods/content.xml"
$text = [IO.File]::ReadAllText($path)

$regexOptions = [System.Text.RegularExpressions.RegexOptions]::Singleline
$rowMatches = [regex]::Matches($text, "<table:table-row[^>]*?>(.*?)</table:table-row>", $regexOptions)
Write-Output "Found $($rowMatches.Count) rows"

$results = @()
foreach ($rowMatch in $rowMatches) {
    $rowData = $rowMatch.Groups[1].Value
    $cellMatches = [regex]::Matches($rowData, "<table:table-cell[^>]*?>(.*?)</table:table-cell>", $regexOptions)
    $cells = @()
    foreach ($cellMatch in $cellMatches) {
        $cellData = $cellMatch.Groups[1].Value
        $textMatch = [regex]::Match($cellData, "<text:p>(.*?)</text:p>", $regexOptions)
        if ($textMatch.Success) {
            $cells += $textMatch.Groups[1].Value.Trim()
        } else {
            $valMatch = [regex]::Match($cellMatch.Value, "office:value=`"(.*?)`"", $regexOptions)
            if ($valMatch.Success) {
                $cells += $valMatch.Groups[1].Value
            } else {
                $cells += ""
            }
        }
    }
    
    if ($cells.Count -ge 8 -and $cells[0] -ne "Nombre" -and $cells[0] -ne "") {
        $obj = [PSCustomObject]@{
            Nombre = $cells[0]
            Apellido = $cells[1]
            Email = $cells[5]
            Nota1 = $cells[6]
            Nota2 = $cells[7]
            Nota3 = $cells[8]
            Total = $cells[9]
            Timestamp = $cells[10]
        }
        $results += $obj
    }
}

$results | ConvertTo-Json | Out-File -FilePath "scratch/ods_data.json" -Encoding utf8
Write-Output "Extracted $($results.Count) records to scratch/ods_data.json"
