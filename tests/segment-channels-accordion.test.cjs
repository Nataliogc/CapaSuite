const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('channels card groups by segment with desplegables and avoids fake duplicate segments', () => {
    const html = fs.readFileSync('AnalisisSegmentos.html', 'utf8');
    assert.ok(html.includes('id="btn-toggle-all-channel-segments"'), 'Must have toggle all channel segments button');
    assert.ok(html.includes('Segmento / Canal'), 'Column header should be Segmento / Canal');

    const jsCode = fs.readFileSync('js/segment-dashboard.js', 'utf8');
    assert.ok(jsCode.includes('toggleChannelSegment'), 'Must define toggleChannelSegment');
    assert.ok(jsCode.includes('toggleAllChannelSegments'), 'Must define toggleAllChannelSegments');
    assert.ok(jsCode.includes('expandedChannelSegments'), 'Must define expandedChannelSegments Set');
    assert.ok(jsCode.includes('rawChannels.length'), 'Must count real channels from segment.channels');
});
