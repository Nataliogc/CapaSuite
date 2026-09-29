const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../AnalisisProduccion.html'), 'utf8');
const budgetCode = html.slice(html.indexOf('            // --- BUDGET PROGRESS INTEGRATION ---'), html.indexOf('\n        function renderTable(')).replace(/\n        }\s*$/, '');
const heatmapCode = html.slice(html.indexOf('        function renderHeatmap()'), html.lastIndexOf('</script>'));
function elements() {
    const values = {};
    return { values, getElementById(id) { return values[id] ||= { style: {}, innerHTML: '', innerText: '', value: '' }; } };
}
test('saved budgets do not interrupt table/charts refresh for either hotel and period', () => {
    for (const currentHotel of ['Guadiana', 'Cumbria']) for (const midx of [-1, 0]) {
        const document = elements();
        const revenue = Array(12).fill(100);
        const data = { otb: {revenue} };
        const calls = [];
        vm.runInNewContext(budgetCode, {
            document, currentHotel, currentYear:'2026', midx, data,
            db: {[currentHotel]: {custom_budget_2026:{rev:revenue,adr:Array(12).fill(60)}}},
            revTY: 100, adrTY: 50, groupedTY:{HABITACION:{revenue}}, groupedLY:{},totalTY:{},totalLY:{},
            fmt:String,fmtNum:String,
            renderTable:()=>calls.push('table'),renderCharts:()=>calls.push('charts'),renderHeatmap:()=>calls.push('heatmap')
        });
        assert.deepEqual(calls,['table','charts','heatmap']);
    }
});
test('switching to a period without budget clears the old target labels', () => {
    const document=elements();
    for(const id of ['total','hab','adr']) document.getElementById(`target-label-${id}`).style.display='block';
    vm.runInNewContext(budgetCode,{
        document,currentHotel:'Guadiana',currentYear:'2025',midx:-1,data:{},db:{Guadiana:{}},
        groupedTY:{},groupedLY:{},totalTY:{},totalLY:{},revTY:0,fmt:String,
        renderTable(){},renderCharts(){},renderHeatmap(){}
    });
    for(const id of ['total','hab','adr']) assert.equal(document.getElementById(`target-label-${id}`).style.display,'none');
});
test('heatmap filters year and month and clears old hotel values when daily data is absent', () => {
    const document=elements();
    document.getElementById('heatmapMetricSelector').value='rn';
    document.getElementById('monthSelector').value='0';
    const context=vm.createContext({document,fmt:String,currentHotel:'Guadiana',currentYear:'2026',db:{
        Guadiana:{2026:{daily:{'2026-01-05':{rooms:12},'2025-01-06':{rooms:999},'2026-02-02':{rooms:888}}}},
        Cumbria:{2026:{}}
    }});
    vm.runInContext(heatmapCode,context);
    vm.runInContext('renderHeatmap()',context);
    assert.match(document.getElementById('weekday-heatmap').innerHTML,/12\.0 RN/);
    context.currentHotel='Cumbria';
    vm.runInContext('renderHeatmap()',context);
    assert.match(document.getElementById('weekday-heatmap').innerHTML,/Sin datos diarios/);
    assert.doesNotMatch(document.getElementById('weekday-heatmap').innerHTML,/12\.0 RN/);
});
