const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const KEY = 'hotel_manager_db_v2';
function setup(local, remote = local) {
    const storage = { [KEY]: JSON.stringify(local) };
    let cloud = { hotelData: JSON.stringify(remote), compData: JSON.stringify({ untouched: 1 }) };
    const timers = new Map(), alerts = [], handlers = {};
    let writes = 0, failed = false, timer = 0, listener, delay;
    const ref = {
        async once() { if (failed) throw Error('offline'); return { val: () => cloud }; },
        async transaction(update) {
            if (delay) await delay;
            if (failed) throw Error('offline');
            cloud = update(cloud); writes++;
            return { committed: true, snapshot: { val: () => cloud } };
        },
        on(_, cb) { listener = cb; }, off() {}
    };
    const database = () => ({ ref: () => ref }); database.ServerValue = { TIMESTAMP: 1 };
    const context = vm.createContext({
        console: {log(){},error(){}}, Map, Set, JSON, Object, Array,
        firebase: { apps: [1], database, auth: () => ({ currentUser: { uid: 'account' } }) },
        localStorage: { getItem: () => null },
        window: { location: {hostname:'example.com',pathname:'/test'}, addEventListener: (n,fn)=>handlers[n]=fn, dispatchEvent(){} },
        document: {getElementById:()=>null}, CustomEvent: function(){},
        CapaStorage: {getItem:k=>storage[k] ?? null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},
        setTimeout: fn=>{ timers.set(++timer,fn); return timer; }, clearTimeout:id=>timers.delete(id), alert:m=>alerts.push(m)
    });
    vm.runInContext(fs.readFileSync('js/firebase-auth.js','utf8'),context);
    const run = s=>vm.runInContext(s,context);
    return { run, storage, alerts, timers, handlers, cloud:()=>JSON.parse(cloud.hotelData), writes:()=>writes,
        edit: value=>context.CapaStorage.setItem(KEY,JSON.stringify(value)), fail:()=>failed=true,
        remote: value=>cloud.hotelData=JSON.stringify(value), push:()=>listener({val:()=>cloud}), delay:p=>delay=p };
}
test('download never echoes the old browser snapshot back to cloud', async()=>{
    const s=setup({Guadiana:{2025:1}},{Guadiana:{2006:2,2025:1}});
    assert.equal(await s.run('downloadFromCloud()'),true);
    assert.equal(s.writes(),0); assert.equal(s.timers.size,0);
    assert.ok(JSON.parse(s.storage[KEY]).Guadiana[2006]);
});
test('stale browser changes preserve remote historical years and other months', async()=>{
    const base={Guadiana:{2025:{revenue:[1,2]}}};
    const s=setup(base); await s.run('downloadFromCloud()');
    s.edit({Guadiana:{2025:{revenue:[3,2]}}});
    s.remote({Guadiana:{2006:{revenue:[900]},2025:{revenue:[1,8]}}});
    await s.run('uploadToCloud()');
    assert.deepEqual(s.cloud(),{Guadiana:{2006:{revenue:[900]},2025:{revenue:[3,8]}}});
    assert.equal(s.timers.size,0);
});
test('only an explicit local deletion removes an existing year',async()=>{
    const s=setup({Guadiana:{2006:1,2025:2}}); await s.run('downloadFromCloud()');
    s.edit({Guadiana:{2025:2}}); s.remote({Guadiana:{2006:1,2010:3,2025:2}});
    await s.run('uploadToCloud()'); assert.deepEqual(s.cloud(),{Guadiana:{2010:3,2025:2}});
});
test('failed upload is reported without a success alert and retains pending work',async()=>{
    const s=setup({Guadiana:{2025:1}}); await s.run('downloadFromCloud()');
    s.edit({Guadiana:{2025:2}}); s.fail(); await s.run('window.forceCloudUpload()');
    assert.match(s.alerts[0],/No se ha confirmado/); assert.equal(s.run('pendingChanges.size'),1);
});
test('edits during upload are preserved and queued for the next save',async()=>{
    const s=setup({Guadiana:{2025:1}}); await s.run('downloadFromCloud()');
    s.edit({Guadiana:{2025:2}}); let finish; s.delay(new Promise(r=>finish=r));
    const pending=s.run('uploadToCloud()'); s.edit({Guadiana:{2025:3}}); finish(); await pending;
    assert.equal(JSON.parse(s.storage[KEY]).Guadiana[2025],3); assert.equal(s.run('pendingChanges.size'),1);
    await s.run('uploadToCloud()'); assert.equal(s.cloud().Guadiana[2025],3);
});
test('remote listener refreshes UI data without an upload',async()=>{
    const s=setup({Guadiana:{2025:1}}); await s.run('downloadFromCloud()'); s.run("startCloudListener('account')");
    s.remote({Guadiana:{2006:8,2025:1}}); s.push();
    assert.equal(JSON.parse(s.storage[KEY]).Guadiana[2006],8); assert.equal(s.timers.size,0);
});
test('closing an idle tab never writes its snapshot',async()=>{
    const s=setup({Guadiana:{2025:1}}); await s.run('downloadFromCloud()');
    s.handlers.beforeunload({preventDefault(){throw Error('unexpected prompt');}}); assert.equal(s.writes(),0);
});
test('getUserDisplayName correctly maps all suite users and fallbacks', () => {
    const s = setup({});
    assert.equal(s.run("window.getUserDisplayName('dianahotelguadiana@gmail.com')"), 'Diana');
    assert.equal(s.run("window.getUserDisplayName({ email: 'ssanchez@hotelguadiana.es' })"), 'Sergio');
    assert.equal(s.run("window.getUserDisplayName({ email: 'osanchez@hotelguadiana.es' })"), 'Oscar');
    assert.equal(s.run("window.getUserDisplayName({ email: 'comunicaciones@hotelguadiana.es' })"), 'Natalio');
    assert.equal(s.run("window.getUserDisplayName({ email: 'unknown@hotel.com', displayName: 'Custom' })"), 'Custom');
});

