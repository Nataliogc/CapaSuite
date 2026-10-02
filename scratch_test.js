const fs = require('fs');

// We know Base Rev: [47394, 48078, 69417, 84283, 100064, 77802, 76405, 75141, ...]
// Let's find where 47394 or 969226 comes from in the repo or calculate it.
const totalA = 969226.00;
const totalB = 997050.67;
const totalC = 1038787.68;
const totalD = 1066612.35;

console.log('Total A:', totalA);
console.log('Total B:', totalB);
console.log('Total C:', totalC);
console.log('Total D:', totalD);
console.log('Base total rev =', totalA / 1.045);
