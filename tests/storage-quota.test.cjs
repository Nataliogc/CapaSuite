const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(initial, limit) {
 const data = {...initial};
 const storage = {get length(){return Object.keys(data).length},key:i=>Object.keys(data)[i],getItem:k=>data[k]??null,removeItem:k=>delete data[k],setItem(k,v){const next={...data,[k]:String(v)};if(Object.values(next).join('').length>limit)throw Object.assign(Error('full'),{name:'QuotaExceededError'});data[k]=String(v)}};
 const c={localStorage:storage,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,CustomEvent:function(){}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/storage.js','utf8'),c);return {c,data};
}
test('full storage still exposes existing database and preserves distinct legacy data',()=>{
 const {c,data}=setup({v3_db:'old',db:'different'},12);
 assert.equal(c.CapaStorage.getItem('db'),'old');assert.equal(data.db,'different');
 assert.equal(c.CapaStorage.setItem('db','new').persistent,false);
 assert.equal(c.CapaStorage.getItem('db'),'new');assert.equal(data.v3_db,'old');
});
test('startup frees only exact duplicates and writes leave Firebase headroom',()=>{
 const {c,data}=setup({v3_db:'same',db:'same','firebase:auth':'keep'},40000);
 assert.equal(data.db,undefined);assert.equal(data['firebase:auth'],'keep');
 assert.equal(c.CapaStorage.setItem('db','x'.repeat(6000)).persistent,true);
 c.localStorage.setItem('firebase:previous_websocket_failure','true');
 assert.equal(c.CapaStorage.setItem('db','x'.repeat(39000)).persistent,false);
 assert.equal(data.v3_db.length,6000);assert.equal(data.__capasuite_headroom__,undefined);
});
test('commissions use one managed write and remain available without native storage',()=>{
 const {c}=setup({},40000);let writes=0;
 const saved={};c.CapaStorage.getItem=k=>saved[k]??null;c.CapaStorage.setItem=(k,v)=>{writes++;saved[k]=v};c.localStorage.setItem=()=>{throw Error('unexpected native write')};
 c.module={exports:{}};vm.runInContext(fs.readFileSync('js/segment-analysis.js','utf8'),c);
 const s=c.module.exports;s.saveChannelCommissionConfig('Guadiana',{'Booking.com':{pct:17}});
 s.saveChannelCommissionConfig('Guadiana',{'Booking.com':{pct:17}});assert.equal(writes,1);assert.equal(s.getChannelCommissionConfig('Guadiana')['Booking.com'].pct,17);
});

test('Firebase transport flag survives full native storage without hiding other write failures',()=>{
 class NativeStorage {
  constructor(){this.data={};this.full=false;this.errorName='QuotaExceededError';}
  get length(){return Object.keys(this.data).length;}
  key(i){return Object.keys(this.data)[i];}
  getItem(k){return this.data[k]??null;}
  setItem(k,v){if(this.full)throw Object.assign(Error('blocked'),{name:this.errorName});this.data[k]=String(v);}
  removeItem(k){delete this.data[k];}
 }
 const local=new NativeStorage(), session=new NativeStorage();
 local.setItem('v3_db','preserved');local.setItem('firebase:previous_websocket_failure','false');local.full=true;
 const c={Storage:NativeStorage,localStorage:local,sessionStorage:session,console,CustomEvent:function(){}};c.window=c;
 vm.createContext(c);const source=fs.readFileSync('js/storage.js','utf8');vm.runInContext(source,c);
 const key='firebase:previous_websocket_failure';
 assert.doesNotThrow(()=>local.setItem(key,'true'));
 assert.equal(local.getItem(key),'true');assert.equal(local.data[key],'false');
 assert.equal(local.getItem('v3_db'),'preserved');
 assert.throws(()=>local.setItem('firebase:authUser','token'),{name:'QuotaExceededError'});
 assert.throws(()=>local.setItem('v3_db','new'),{name:'QuotaExceededError'});
 assert.equal(session.getItem(key),null);
 local.removeItem(key);assert.equal(local.getItem(key),null);
 local.setItem(key,'true');local.full=false;local.setItem(key,'false');
 assert.equal(local.getItem(key),'false');assert.equal(local.data[key],'false');
 const set=NativeStorage.prototype.setItem;vm.runInContext(source,c);assert.equal(NativeStorage.prototype.setItem,set);
 local.full=true;local.errorName='SecurityError';assert.throws(()=>local.setItem(key,'true'),{name:'SecurityError'});
});

test('all Firebase pages install the storage guard before loading the SDK',()=>{
 for(const file of fs.readdirSync('.').filter(p=>p.endsWith('.html'))){
  const html=fs.readFileSync(file,'utf8');const sdk=html.indexOf('firebase-database.js');if(sdk<0)continue;
  const storage=html.indexOf('js/storage.js');assert.ok(storage>=0&&storage<sdk,file);
 }
});
