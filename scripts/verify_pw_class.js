const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const ws = fs.readFileSync('public/js/workspace.js', 'utf8');
console.log('HTML pw-class-subject-checkboxes:', html.includes('pw-class-subject-checkboxes') ? 'OK' : 'MISSING');
console.log('HTML pw-subject-class-checkboxes:', html.includes('pw-subject-class-checkboxes') ? 'OK' : 'MISSING');
console.log('HTML old select removed:', !html.includes('pw-input-subject-class') ? 'OK' : 'STILL PRESENT');
console.log('WS helpers count pwRenderClassSubjectCheckboxes:', (ws.match(/pwRenderClassSubjectCheckboxes/g)||[]).length);
console.log('WS helpers count pwRenderSubjectClassCheckboxes:', (ws.match(/pwRenderSubjectClassCheckboxes/g)||[]).length);
