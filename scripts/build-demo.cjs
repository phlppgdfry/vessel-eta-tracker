const fs = require('node:fs');
const path = require('node:path');
function copy(source,target) { fs.mkdirSync(path.dirname(target),{recursive:true}); fs.cpSync(source,target,{recursive:true}); }
copy('node_modules/chart.js/dist/chart.umd.js','vendor/chart.umd.js');
copy('node_modules/chart.js/LICENSE.md','vendor/chart.LICENSE.md');
copy('node_modules/leaflet/dist','vendor/leaflet');
copy('node_modules/leaflet/LICENSE','vendor/leaflet/LICENSE');
for(const file of ['index.html','manifest.json']) copy(file,'site/'+file);
copy('vendor','site/vendor');
