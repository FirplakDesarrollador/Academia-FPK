
$path = "Calificaciones/Bienvenida/temp_ods/content.xml"
$text = [IO.File]::ReadAllText($path)

# Extract table-rows
$rowMatches = [regex]::Matches($text, "<table:table-row>(.*?)</table:table-row>")
Write-Output "Found $($rowMatches.Count) rows"

$count = 0
foreach ($rowMatch in $rowMatches) {
    if ($count -gt 20) { break }
    $rowData = $rowMatch.Groups[1].Value
    $cellMatches = [regex]::Matches($rowData, "<table:table-cell.*?>(.*?)</table:table-cell>")
    $cells = @()
    foreach ($cellMatch in $cellMatches) {
        $cellData = $cellMatch.Groups[1].Value
        $textMatch = [regex]::Match($cellData, "<text:p>(.*?)</text:p>")
        if ($textMatch.Success) {
            $cells += $textMatch.Groups[1].Value
        } else {
            $cells += ""
        }
    }
    Write-Output ($cells -join " | ")
    $count++
}
