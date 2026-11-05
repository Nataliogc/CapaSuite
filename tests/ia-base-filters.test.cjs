const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('AnalisisIA.html','utf8');
test('all insight filters select matching cards and priority overlaps categories',()=>{
 const cards=[['pricing','critical'],['competitor','warning'],['distribution','info']].map(([category,priority])=>({style:{},getAttribute:()=>category,classList:{contains:p=>p===priority}}));
 const c={currentFilterCategory:'all',document:{querySelectorAll:s=>s==='.insight-item'?cards:[]}};vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('        function filterInsights('),html.indexOf('        function openDatesModal(')),c);
 for(const category of ['all','priority','pricing','competitor','distribution','budget','pickup','compliance']){
 c.filterInsights(category);assert.equal(cards.filter(x=>x.style.display==='flex').length,category==='all'?3:['priority','pricing','competitor','distribution'].includes(category)?1:0);
 }
 assert.ok(html.includes('filterInsights(currentFilterCategory);'));
});
test('below-base alert uses date-specific hotel base and skips sold, equal and past prices',()=>{
 const iso=new Date().toLocaleDateString('en-CA');const dates=['2099-01-01','2099-01-02','2099-01-03','2000-01-01'];
 const c={compData:{data:dates.map((date,i)=>({date,hotels:{Cumbria:{price:i===1?80:60,sold:i===2}}}))},currentHotel:'Cumbria',insights:[],getDayInfo:()=>({}),parseDateRobust:s=>new Date(s+'T12:00:00'),PricingIntelligence:{getBaseBarForDate:(date,hotel)=>{assert.equal(hotel,'Cumbria');return {bar:80,isException:true}}}};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('            const belowBaseDates ='),html.indexOf('            allGeneratedInsights = insights;')),c);
 assert.equal(c.insights.length,1);assert.equal(c.insights[0].dates.length,1);assert.equal(c.insights[0].dates[0].gap,20);assert.equal(c.insights[0].dates[0].gapPct,25);assert.equal(c.insights[0].priority,'critical');
});

test('pricing remains selected after cards regenerate, even with old content in the container',()=>{
 let cards=[];const container={_html:'old legacy card',get innerHTML(){return this._html},set innerHTML(value){this._html=value;cards=[...value.matchAll(/class="insight-item ([^"]+)" data-category="([^"]+)"/g)].map(m=>({style:{},getAttribute:()=>m[2],classList:{contains:p=>p===m[1]}}));}};
 const session={};const c={container,insights:[{id:'base',category:'pricing',priority:'critical',title:'Base'},{id:'rival',category:'competitor',priority:'warning',title:'Rival'}],currentFilterCategory:'pricing',sessionStorage:{setItem:(k,v)=>session[k]=v},document:{querySelectorAll:s=>s==='.insight-item'?cards:[]}};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('        function filterInsights('),html.indexOf('        function openDatesModal(')),c);
 const start=html.indexOf('            if (container) {',html.indexOf('// Render Filter Buttons'));
 const end=html.indexOf('            filterInsights(currentFilterCategory);\n        }',start)+'            filterInsights(currentFilterCategory);'.length;
 const render='(function(){'+html.slice(start,end)+'})()';
 vm.runInContext(render,c);assert.equal(cards.length,2);assert.equal(cards[0].style.display,'flex');assert.equal(cards[1].style.display,'none');
 vm.runInContext(render,c);assert.equal(c.currentFilterCategory,'pricing');assert.equal(cards[0].style.display,'flex');assert.equal(cards[1].style.display,'none');assert.equal(session.capasuite_ai_filter,'pricing');
});
