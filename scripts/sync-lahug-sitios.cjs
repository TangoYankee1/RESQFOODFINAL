const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const list=JSON.parse(fs.readFileSync(path.join(root,'functions/lib/lahug-sitios.json'),'utf8'));
if(list.length!==48 || new Set(list).size!==48 || list.some(s=>typeof s!=='string'||s!==s.trim()))throw new Error('Expected exactly 48 unique Lahug sitios');
fs.mkdirSync(path.join(root,'public/data'),{recursive:true});
fs.writeFileSync(path.join(root,'public/data/lahug-sitios.json'),JSON.stringify(list,null,2)+'\n');
console.log('Published all 48 Lahug sitios from the canonical backend list.');
