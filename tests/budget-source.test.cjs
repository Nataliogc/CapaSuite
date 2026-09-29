const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../Analisis360.html'),'utf8');
const code=html.slice(html.indexOf('            // BUDGET COMPARISON'),html.indexOf('            // PICK-UP MONITOR'));
function render(hotel,year,db,nodes={}){
 const before=JSON.stringify(db);
 vm.runInNewContext(code,{hotel,currentYear:year,db,midx:-1,habRev:100,adr:50,fmt:String,document:{getElementById:id=>nodes[id]||=( {style:{}} )}});
 assert.equal(JSON.stringify(db),before);
 return nodes;
}
test('default budget sources identify hotel and keep current amounts',()=>{
 const db={Guadiana:{},Cumbria:{}};
 const g=render('Guadiana','2026',db);
 assert.match(g['budget-source'].textContent,/Guadiana.*pendiente de conciliar/);
 assert.equal(g['budget-target-rev'].innerText,'(Obj: 1380239)');
 const c=render('Cumbria','2026',db);
 assert.match(c['budget-source'].textContent,/Cumbria.*pendiente de confirmar/);
 assert.equal(c['budget-target-rev'].innerText,'(Obj: 1196000)');
});
test('saved budgets retain precedence and are not presented as approved',()=>{
 const nodes=render('Guadiana','2026',{Guadiana:{custom_budget_2026:{rev:Array(12).fill(100),adr:Array(12).fill(70)}}});
 assert.equal(nodes['budget-target-rev'].innerText,'(Obj: 1200)');
 assert.equal(nodes['budget-source'].textContent,'Presupuesto guardado de Guadiana · 2026');
});
test('switching to a year without budget clears source and tooltips',()=>{
 const db={Guadiana:{},Cumbria:{}};
 const nodes=render('Guadiana','2026',db);
 render('Cumbria','2027',db,nodes);
 assert.equal(nodes['budget-source'].textContent,'Sin presupuesto para este hotel y año');
 assert.equal(nodes['budget-target-rev'].title,'');
 assert.equal(nodes['budget-target-adr'].title,'');
});
