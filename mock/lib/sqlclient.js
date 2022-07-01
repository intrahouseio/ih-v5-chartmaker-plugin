/**
 * sqlclient.js
 * Mock для тестирования
 */

const util = require('util');

const utils = require('./utils');

class Sqlclient {
  constructor(opt) {
    this.opt = opt;
    this.pool = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  prepareQuery(queryObj) {
    let queryStr;
    if (typeof queryObj == 'string') {
      queryStr = queryObj;
    } else if (queryObj.sql) {
      queryStr = queryObj.sql;
    } else {
      if (!queryObj.dn_prop) return ''; // Нет запроса - просто пустая строка

      const dnarr = queryObj.dn_prop.split(',');
      queryStr = utils.getQueryStr(queryObj, dnarr);
    }

    console.log('SQLClient Query: ' + queryStr);
    return queryStr;
  }

  query(queryStr) {
    if (!queryStr) return Promise.reject('Empty queryStr! ');
    if (typeof queryStr != 'string') return Promise.reject('Expected query as SQL string! ');

    const start = getItFromQuery(/ts >= (\d{13})/);
    if (start.startsWith('ERROR')) return Promise.reject(start);

    const end = getItFromQuery(/ts <= (\d{13})/);
    if (end.startsWith('ERROR')) return Promise.reject(end);

    return new Promise((resolve, reject) => {
      const arr = getArr(start, end);
      resolve(arr);
    });

    function getItFromQuery(regexp) {
      const arr = queryStr.match(regexp);
      return !arr || arr.length < 2 ? 'ERROR: Mismatch query: ' + regexp.toString() : arr[1];
    }
  }

  close() {}
}

function getArr(start, end) {
  /*
  return [
    {dn:'TEST1', prop:'value', ts:now-2000, val: 1},
    {dn:'TEST2', prop:'value', ts:now-2000, val: 10},
    {dn:'TEST1', prop:'value', ts:now-1000, val: 2},
    {dn:'TEST2', prop:'value', ts:now-1000, val: 20},
    {dn:'TEST1', prop:'value', ts:now, val: 3},
    {dn:'TEST2', prop:'value', ts:now, val: 30}
  ]
  */
  const res = [];
  start = Number(start);
  end = Number(end);
  if (start > end) return [];
  let val1 = 1000;
  let val2 = 2000;
  let ts = start;
  while (ts <= end) {
    res.push({ id: 10, ts, val: val1 }, { id: 20, ts, val: val2 });
    ts += 30000; // 30 сек
    val1 += 10;
    val2 += 10;
  }
  return res;
}

module.exports = Sqlclient;
