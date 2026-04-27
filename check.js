const c = require('fs').readFileSync('artifacts/caprina/src/pages/shipping-manifest.tsx', 'utf8');
console.log('ExcelImportDialog:', c.includes('ExcelImportDialog'));
console.log('Upload import:', c.includes('Upload,'));
console.log('showExcelImportDialog state:', c.includes('showExcelImportDialog'));
console.log('normalizeStatus fn:', c.includes('normalizeStatus'));
console.log('ExcelImportDialog render:', c.includes('showExcelImportDialog && manifest'));
console.log('Excel button in JSX:', c.includes('setShowExcelImportDialog(true)'));
