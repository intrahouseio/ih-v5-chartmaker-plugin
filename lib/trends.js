/**
 * trends.js
 * 
 */

const util = require('util');

/**
 * Формировать данные, считанные из БД, для отдачи на график без свертки
 *
 * @param {Array of Objects} records - [{dn,prop,ts,val},...]
 * @param {Array} dnarr ['POO1.temp1','POO1.temp2']
 * @return {Object} : {<dn_prop>:{data:[{x,y},...]}}
 */
module.exports = function (records, readobj) {
  // console.log('getResObject START readobj=' + util.inspect(readobj));
  // if (!dnarr || !dnarr.length || !records || !records.length) return [];

  const res = {};
  let min = readobj.min ?  readobj.min : 0;
  let max = readobj.max ?  readobj.max : 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec || !rec.dn || !rec.prop || !rec.ts) continue;

    const dn_prop = rec.dn + '.' + rec.prop;
    if (!res[dn_prop]) res[dn_prop] = { points: [] };
    res[dn_prop].points.push({ x: rec.ts, y: Number(rec.val) });
    // min-max
    if (rec.val < min) {
      min = rec.val;
    } else if (rec.val > max) {
      max = rec.val;
    }
  }
 
  // Если данных нет - item все равно должен быть, хотя бы пустой
  const arr = [];
  readobj.columns.forEach(colItem => {
    const dn_prop = colItem.dn_prop;
    const item = { points: [], ...colItem, id: dn_prop };
    if (res[dn_prop]) item.points = res[dn_prop].points;
    arr.push(item);
  });
  const result = { items: arr, min, max, start: readobj.start, end: readobj.end };
  return result;
}

