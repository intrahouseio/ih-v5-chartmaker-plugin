/**
 * trends.js
 *
 */

// const util = require('util');

/**
 * Формировать данные, считанные из БД, для отдачи на график без свертки
 *
 * @param {Array of Objects} records - [{dn,prop,ts,val},...]
 * @param {Array} dnarr ['POO1.temp1','POO1.temp2']
 * @return {Object} : {<dn_prop>:{data:[{x,y},...]}}
 */
module.exports = function(records, readobj) {
  const res = {};

  let min;
  let max;
  if (records.length) {
    min = records[0].val;
    max = records[0].val;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec || !rec.dn || !rec.prop || !rec.ts) continue;

      const dn_prop = rec.dn + '.' + rec.prop;
      if (!res[dn_prop]) res[dn_prop] = { points: [] };
      res[dn_prop].points.push({ x: rec.ts, y: rec.val });
      // res[dn_prop].points.push({ x: rec.ts, y: Number(rec.val) });
      // min-max
      if (rec.val < min) {
        min = rec.val;
      } else if (rec.val > max) {
        max = rec.val;
      }
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

  // Выбрать min/max. Изменить интервал на 10%, если упор
  if (min == undefined) {
    min = readobj.min || 0;
  } else if (readobj.min == undefined || min <= readobj.min) {
    // Если ноль - оставляем 0
    min = min != 0 ? Math.round(min - min * 0.05) : 0;
  } else min = readobj.min;

  if (max == undefined) {
    max = readobj.max || 1;
  } else if (readobj.max == undefined || max >= readobj.max) {
    max = Math.round(max + max * 0.05);
  } else max = readobj.max;

  const result = { items: arr, min, max, start: readobj.filter.start, end: readobj.filter.end };
  return result;
};
