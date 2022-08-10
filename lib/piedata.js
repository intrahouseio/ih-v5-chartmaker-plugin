/**
 * piedata.js
 * Свертка массива, полученного из БД, для круговой диаграммы
 */

const util = require('util');


/**
 * @param {Array of Objects} arr - данные, полученные из БД, упорядочены по ts
 *        [{ts,dn,prop,val},...]
 * @param {Object} readobj:{
 *          calc_fun  (min,max,sum))
 *
 * @return {Object} -  { "items": [
 *              { value, color: item.fillColor, legend: item.legend }, 
 *               ...
 *            ]}
 */
module.exports = function rollup(arr, readobj) {
  const reportVars = readobj.columns;

  const calc_fun = readobj.calc_fun || 'last';
  if (!Array.isArray(arr) || !arr.length || !reportVars || !Array.isArray(reportVars)) return;

  let vals = {}; // {<dn_prop>:220} - накапливаются данные
  let counts = {}; // {<dn_prop>:22} - накапливаются количество

  reportVars.forEach(item => {
    if (item.dn_prop) {
      if (!vals[item.dn_prop]) {
        vals[item.dn_prop] = 0;
        counts[item.dn_prop] = 0;
      }
    }
  });

  createResult();

  // Поместить в массив, добавить цвет и легенду?
  let sumAll = 0;
  const items = [];
  reportVars.forEach(item => {
    if (item.dn_prop) {
      const value = fin_value(calc_fun, item.dn_prop);
      sumAll += value;
      items.push({ value, color: item.fillColor, legend: item.legend });
    }
  });

  if (readobj.calc_percent) {
    items.forEach(item => {
      item.value = Math.round(item.value*100/sumAll);
    })
  }

  return { items };

  function createResult() {
    let j = 0;

    let dn_prop;
    let curval;
    while (j < arr.length) {
      dn_prop = arr[j].dn + '.' + arr[j].prop;
      curval = Number(arr[j].val);
      if (counts[dn_prop] != undefined) {
        calcVal(calc_fun, dn_prop, curval);
        counts[dn_prop] += 1;
      }
      j++;
    }
  }
  /*
  function initVal(calc_type, varname, val) {
    let ival = val;

    switch (calc_type) {
      case 'min':
      case 'max':
      case 'first':
      case 'last':
        ival = val;
        break;

      case 'sum':
      case 'avg':
        ival = 0;
        break;

      default:
        ival = val;
    }

    vals[varname] = ival;
  }
  */

  function calcVal(calc_type, varname, val) {
    switch (calc_type) {
      case 'sum':
      case 'avg':
        vals[varname] += val;
        break;

      case 'min':
        if (val < vals[varname]) vals[varname] = val;
        break;

      case 'max':
        if (val > vals[varname]) vals[varname] = val;
        break;

      case 'last': //  first - первое взяли, больше не присваиваем
        vals[varname] = val;
        break;

      default:
        vals[varname] = val;
    }
  }

  function fin_value(calc_type, dn_prop) {
    switch (calc_type) {
      case 'avg':
        return counts[dn_prop] > 0 ? vals[dn_prop] / counts[dn_prop] : 0;
      case 'count':
          return counts[dn_prop];
      default:
        return vals[dn_prop];
    }
  }
};
