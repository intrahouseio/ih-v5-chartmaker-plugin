/**
 * linedata.js
 *
 * Формировать данные, считанные из БД, для отдачи на график без свертки
 *
 * @param {Array of Objects} records - [{dn,prop,ts,val},...]
 * @param {Object} readobj
 * @param {Object} query
 *
 * @return {Object} : { items: arr, min, max, start, end }
 *   items = [{points: [], id: dn_prop, ...}, ...]
 */

const util = require('util');

const chartutil = require('./chartutils');

module.exports = async function(records, readobj, query, useIds, client, plugin) {
  const res = {};

  // [{dn,prop,ts,val},...] => {AI005.value:{points:[{x,y}]}}
  if (records.length) {
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec || !rec.dn || !rec.prop || !rec.ts) continue;
      const dn_prop = rec.dn + '.' + rec.prop;
      if (!res[dn_prop]) res[dn_prop] = { points: [] };
      res[dn_prop].points.push({ x: rec.ts, y: rec.val });
    }
  }

  const arr = [];
  for (const colItem of readobj.columns) {
    const step = colItem.interpolation == 'step';
    const dn_prop = colItem.dn_prop;
    const decdig = chartutil.getDecdig(colItem.decdig);
    const q1 = useIds ? { ids: getIdForDn_prop(dn_prop, query) } : { dn_prop };
    q1.notnull = readobj.notnull;
    const item = { points: [], ...colItem, id: dn_prop };

    let leftPoint;
    try {
      if (readobj.edge) {
        leftPoint = await queryNearbyPointFromDB({ ...q1, start: '', end: query.start }, 'left');
        // plugin.log('INFO: queryNearbyPointFromDB: leftPoint=' + util.inspect(leftPoint));
      }
    } catch (e) {
      plugin.log('ERROR: queryNearbyPointFromDB: ' + util.inspect(e));
    }

    try {
      if (res[dn_prop] && res[dn_prop].points.length) {
        item.points = res[dn_prop].points;
        if (readobj.edge) {
          await getNearbyPoints(leftPoint, step, q1, item.points, decdig);
          plugin.log('INFO: After getNearbyPoints for right: item.points=' + util.inspect(item.points, null, 4));
        }
      } else if (readobj.edge) {
        item.points = await getNearbyPointsWhenNodata(leftPoint, step, q1, decdig);
        plugin.log('INFO: After getNearbyPointsWhenNodata: item.points=' + util.inspect(item.points, null, 4));
      }
    } catch (e) {
      plugin.log('ERROR: ' + util.inspect(e));
    }

    arr.push(item);
  }
  const result = { items: arr, start: readobj.filter.start, end: readobj.filter.end };
  // console.log('result = ' + util.inspect(result));
  return result;

  async function getNearbyPoints(leftPoint, step, q1, points, decdig = 0) {
    // добавим краевые точки
    const first = leftPoint ? getFirst(step, leftPoint, points, decdig) : '';
    if (first) points.unshift(first);

    let rightPoint = step ? '' : await queryNearbyPointFromDB({ ...q1, start: query.end, end: '' }, 'right');
    let last = getLast(step, rightPoint, points, decdig);
    if (last) points.push(last);
  }

  async function getNearbyPointsWhenNodata(leftPoint, step, q1, decdig = 0) {
    if (!readobj.edge) return [];

    // Если данных нет - points все равно должен быть, хотя бы пустой
    if (!leftPoint || leftPoint.y == null) {
      // точки слева тоже нет
      return [];
    }

    // Если график step - справа не берем
    if (step) {
      return [
        { x: query.start, y: leftPoint.y, hide: 1 },
        { x: query.end, y: leftPoint.y, hide: 1 }
      ];
    }

    // график линейный
    const rightPoint = await queryNearbyPointFromDB({ ...q1, start: query.end, end: '' }, 'right');
    if (!rightPoint || rightPoint.y == null) {
      // точки справа нет, но слева есть - продлим
      return [
        { x: query.start, y: leftPoint.y, hide: 1 },
        { x: query.end, y: leftPoint.y, hide: 1 }
      ];
    }

    // есть обе точки - нужна интерполяция
    return [
      { ...chartutil.getPointAtX(leftPoint, rightPoint, query.start, decdig), hide: 1 },
      { ...chartutil.getPointAtX(leftPoint, rightPoint, query.end, decdig), hide: 1 }
    ];
  }

  function getFirst(step, leftPoint, pointArr, decdig) {
    let first = leftPoint; // для step
    if (!step) {
      first = chartutil.getPointAtX(leftPoint, pointArr[0], query.start, decdig);
    }

    if (first && first.y != null) {
      return { x: query.start, y: first.y, hide: 1 };
    }
  }

  function getLast(step, rightPoint, pointArr, decdig) {
    if (!pointArr || !pointArr.length) return;

    let lastP = pointArr[pointArr.length - 1];
    let last;
    if (step) {
      last = { x: query.end, y: lastP.y };
    } else {
      if (!rightPoint) return;
      last = chartutil.getPointAtX(lastP, rightPoint, query.end, decdig);
    }
    return { ...last, hide: 1 };
  }

  async function queryNearbyPointFromDB(q1, side) {
    let sqlStr = client.prepareQuery(q1, useIds); // Эта функция должна сформировать запрос с учетом ids
    if (!sqlStr) {
      plugin.log('queryNearbyPointFromDB sqlStr for query ' + util.inspect(q1) + ' is empty');
      return;
    }

    try {
      const dir = side == 'left' ? ' DESC' : ' ASC';
      sqlStr += dir + ' LIMIT 1';

      const one = await client.query(sqlStr);
      if (!one.length) return;

      return { x: one[0].ts, y: one[0].val };
    } catch (e) {
      plugin.log('linedata Query rejected for SQL: ' + sqlStr);
    }
  }

  function getIdForDn_prop(dn_prop) {
    if (!query.ids || !query.dn_prop) return;
    const idArr = query.ids.split(',');
    const dnArr = query.dn_prop.split(',');
    if (idArr.length != dnArr.length) throw { message: 'getIdForDn_prop: Invalid ids or dn_prop, query=' + util.inspect(query) };
    const idx = dnArr.findIndex(dn_prop);
    if (idx < 0) throw { message: 'getIdForDn_prop: Not found id for ' + dn_prop + ' query=' + util.inspect(query) };
    return idArr[idx];
  }
};
