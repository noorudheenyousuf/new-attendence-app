const fs = require('fs');
const app = fs.readFileSync('public/js/app.js', 'utf8');
const idx = app.indexOf('add-sub-class-checkboxes');
console.log('2a context:', JSON.stringify(app.slice(idx - 80, idx + 120)));
const idx2 = app.indexOf('siblingClasses');
console.log('2c context:', JSON.stringify(app.slice(idx2 - 100, idx2 + 300)));
const idx3 = app.indexOf('inAssignedClasses');
console.log('2e context:', JSON.stringify(app.slice(idx3 - 50, idx3 + 280)));
