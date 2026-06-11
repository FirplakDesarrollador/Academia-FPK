
const fs = require('fs');
let content = fs.readFileSync('scratch/ods_data.json', 'utf8');
if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
}
const data = JSON.parse(content);

let max1 = 0, max2 = 0, max3 = 0;
data.forEach(r => {
    const n1 = parseFloat(r.Nota1);
    const n2 = parseFloat(r.Nota2);
    const n3 = parseFloat(r.Nota3);
    if (!isNaN(n1)) max1 = Math.max(max1, n1);
    if (!isNaN(n2)) max2 = Math.max(max2, n2);
    if (!isNaN(n3)) max3 = Math.max(max3, n3);
});

console.log(`Max1: ${max1}, Max2: ${max2}, Max3: ${max3}`);
