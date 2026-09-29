const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'Analisis360.html'),'utf8');
function setup(){
 const ctx=vm.createContext({currentYear:'2099'});
 vm.runInContext(fs.readFileSync(path.join(root,'js/production-groups.js'),'utf8'),ctx);
 vm.runInContext(html.slice(html.indexOf('        function getGroupedProduction('),html.indexOf('        function renderKPIRow(')),ctx);
 vm.runInContext(html.slice(html.indexOf('        function segmentRoomRevenue('),html.indexOf('        function renderCharts(')),ctx);
 return ctx;
}
const a=n=>[n,...Array(11).fill(0)];
test('360 excludes other departments in real, OTB and projected income without modifying source',()=>{
 const c=setup();
 const data={service:{room:{name:'HABITACION DOBLE',revenue:a(100),rooms:a(2)},suite:{name:'SUITE',revenue:a(200),rooms:a(1)},food:{name:'DESAYUNO',revenue:a(900)},spa:{name:'SPA',revenue:a(800)},TOTAL_MASTER:{name:'TOTAL_MASTER',revenue:a(2000),rooms:a(3)}},otb:{revenue:a(1500),rooms:a(4),breakdown:{habitacion:a(400)}}};
 const before=JSON.stringify(data);
 for(const [mode,expected] of [['real',300],['otb',400],['projected',700]]){
  const result=c.aggregateServices(data,0,mode);
  assert.equal(result.totalRev,expected);
  assert.deepEqual(Object.keys(result.summary),['Habitaciones']);
  assert.ok(result.raw.every(r=>r.category==='Habitaciones'));
 }
 assert.equal(JSON.stringify(data),before);
});
test('total OTB is not substituted for rooms income when its breakdown is absent',()=>{
 const result=setup().aggregateServices({otb:{revenue:a(900),rooms:a(4)}},0,'otb');
 assert.equal(result.totalRev,0);
 assert.equal(result.missingRoomBreakdown,true);
});
test('segment totals and legacy accommodation fallback cannot introduce breakfast or spa income',()=>{
 const c=setup();
 assert.equal(c.segmentRoomRevenue({revenue:a(999),accommodation:a(999)}),null);
 const result=c.segmentRoomRevenue({revenue:a(999),accommodation:a(999),concepts:{'HABITACION DOBLE':a(100),SUITE:a(200),DESAYUNO:a(400),SPA:a(299)}});
 assert.equal(result[0],300);
});
