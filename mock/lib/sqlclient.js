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

    console.log('SQLClient Query: '+queryStr)
    return queryStr;
  }


  query(queryStr) {
   
    if (!queryStr) return Promise.reject('Empty queryStr! ');
    if (typeof queryStr != 'string') return Promise.reject('Expected query as SQL string! ');

    return new Promise((resolve, reject) => {
      const arr = getArr(queryStr);
      resolve(arr);
    });
  }

  close() {
   
  }
}


function getArr(queryStr) {
  const now = Date.now();

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
 return [
  {id:10, ts:now-2000, val: 1},
  {id:20, ts:now-2000, val: 10},
  {id:10, ts:now-1000, val: 2},
  {id:20, ts:now-1000, val: 20},
  {id:10, ts:now, val: 3},
  {id:20, ts:now, val: 30}
  ]
}

module.exports = Sqlclient;
