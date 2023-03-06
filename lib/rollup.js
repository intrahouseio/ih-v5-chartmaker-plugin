/**
 * rollup.js
 * Свертка массива, полученного из БД, для графиков
 * Результат - {<id>:[{x,y}, ]}
 */

const util = require('util');

// const hut = require('./hut');
// const dateutils = require('./dateutils');
// const reportutil = require('./reportutil');

/**
 * @param {Array of Objects} arr - данные, полученные из БД, упорядочены по ts
 *        [{ts,dn,prop,val},...]
 * @param {Object} readobj:{
 *          calc_fun  (min,max,sum))
 *          discrete: дискрета для свертки
 *             ('month','day','hour','min')
 *          columns: {Array of Objects} - описание переменных графика
 *             [{id, dn_prop }, ]
 *         filter: {start, end<, end2>}
 *
 * @return {Array of Object} - массив объектов для каждого dn_prop:  [{id:<dn_prop>, points:[{x,y}]]
 */
module.exports = function rollup(arr, readobj) {
  const discrete = readobj.discrete;
  // const dkoeff = readobj.dkoeff; // Множитель дискреты

  const reportVars = readobj.columns;
  const calc_fun = readobj.calc_fun;
  let min = 0;
  let max = 0;

  const reportEnd = readobj.end; // Для diff вытаскиваем на 1 дискрету больше
  // console.log('rollup START reportVars=' + util.inspect(reportVars) + ' arr LEN=' + arr.length);
  if (!Array.isArray(arr) || !arr.length || !reportVars || !Array.isArray(reportVars)) return;

  // В зависимости от дискреты заполнить поле dtx из ts (YYMMDDHH)
  for (let ii = 0; ii < arr.length; ii++) {
    if (arr[ii].ts) arr[ii].dtx = discrete ? transform(arr[ii].ts, discrete) : arr[ii].ts;
  }

  let vals = {}; // {<dn_prop>:22} - накапливаются данные
  let counts = {}; // {{<dn_prop>:1} - накапливается число записей в БД

  let mapIndex = {}; // Из columns массива сделать объект <dn_prop>:<column_item>

  let diffIndex = {}; // Собрать имена переменных для рассчета diff

  const result = {};

  reportVars.forEach(item => {
    if (item.dn_prop) {
      if (!result[item.dn_prop]) result[item.dn_prop] = { id: item.dn_prop, points: [] };
      if (!item.calc_type) item.calc_type = calc_fun;

      if (!mapIndex[item.dn_prop]) mapIndex[item.dn_prop] = item;
      if (item.calc_type == 'diff') {
        if (!diffIndex[item.dn_prop]) diffIndex[item.dn_prop] = item.dn_prop;
      }
    }
  });

  // Если есть функция diff  для каких-то переменных?? - нужно собрать first по интервалам в
  const diffValsMap = new Map();
  if (Object.keys(diffIndex).length) {
    gatherDiffVals();
  }

  if (diffValsMap.size) {
    createDiffResult();
  } else {
    createResult();
  }

  // Из объекта нужно сделать массив!!

  // return reportVars.map(item => ({ id: item.dn_prop, points: result[item.dn_prop].points }));

  // Если данных нет - item все равно должен быть, хотя бы пустой
  const resArr = [];
  readobj.columns.forEach(colItem => {
    const dn_prop = colItem.dn_prop;
    const item = { points: [], ...colItem, id: dn_prop };
    if (result[dn_prop]) item.points = result[dn_prop].points;
    resArr.push(item);
  });

  return { items: resArr, min, max, start: readobj.start, end: readobj.end, unit: discrete };

  function createResult() {
    let j = 0;
    let curdtx = arr[j].dtx;

    let dn_prop;
    let curval;
    while (j < arr.length) {
      if (curdtx == arr[j].dtx) {
        dn_prop = arr[j].dn + '.' + arr[j].prop;
        curval = Number(arr[j].val);
        // console.log('createResult curdtx=' + curdtx + ' curval=' + curval);

        // Устройство участвует в графике
        if (mapIndex[dn_prop]) {
          const mapItem = mapIndex[dn_prop];

          const varName = mapItem.dn_prop;
          if (vals[varName] == undefined) {
            initVal(mapItem.calc_type, varName, curval);
            counts[varName] = 0;
          }
          calcVal(mapItem.calc_type, varName, curval);
          counts[varName] += 1;
        }
        j++;
      } else {
        addPoints(curdtx);
        vals = {};
        counts = {};
        curdtx = arr[j].dtx;
      }
    }
    addPoints(curdtx);
  }

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

  function addPoints(curdtx, diffItem) {
    let x;
    if (discrete) {
      x = getStartTsFromDtx(curdtx, discrete);
    } else x = curdtx;

    let y = NaN;
    reportVars.forEach(item => {
      if (item.calc_type == 'avg') {
        y = counts[item.dn_prop] > 0 ? vals[item.dn_prop] / counts[item.dn_prop] : '';
      } else if (item.calc_type == 'diff') {
        if (diffItem) y = diffItem[item.dn_prop];
      } else if (item.calc_type == 'count') {
        y = counts[item.dn_prop];
      } else y = vals[item.dn_prop] != undefined ? vals[item.dn_prop] : NaN;

      result[item.dn_prop].points.push({ x, y });

      // min-max
      if (y < min) {
        min = y;
      } else if (y > max) {
        max = y;
      }
    });
  }

  function createDiffResult() {
    /*
    
    let j = 0;
    let curdtx = arr[0].dtx;

    let dn_prop;
    let curval;
    while (j < arr.length && arr[j].ts <= reportEnd) {
      if (curdtx == arr[j].dtx) {
        dn_prop = arr[j].dn + '.' + arr[j].prop;
        curval = Number(arr[j].val);

        // Устройство участвует в отчете
        if (mapIndex[dn_prop]) {
          const mapItem = mapIndex[dn_prop];
          
            const varName = mapItem.varname;
            if (vals[varName] == undefined) {
              initVal(mapItem, varName, curval);
              counts[varName] = 0;
            }
            calcVal(mapItem, varName, curval);
            counts[varName] += 1;
          
        }
        j++;
      } else {
        result.push(getOneRowObj(curdtx, diffValsMap.get(curdtx)));
        curdtx = arr[j].dtx;
        vals = {};
        counts = {};
      }
    }
    result.push(getOneRowObj(curdtx, diffValsMap.get(curdtx)));
    return result;
    */
  }

  /*
  function formatFields(one) {
    reportVars
      .filter(item => item.col_type == 'calc' || item.col_type == 'value')
      .forEach(item => {
        let val = one[item.varname];
        if (typeof val == 'number') {
          val = val.toFixed(item.decdig);
          one[item.varname] = val;
        }
      });
  }
    */

  /**
   * Сформировать значения для calc_type = diff
   * Результат - diffValsMap = {<curdtx>:{:<varname>:xx, }}
   */
  function gatherDiffVals() {
    // diffIndex = {'VMETER1.value':'rmeter1', <dn_prop>:<varname>...}
    const varNames = Object.keys(diffIndex).map(dp => diffIndex[dp]);

    let prevObj = {};
    let lastObj = {};
    Object.keys(diffIndex).forEach(dp => {
      const varName = diffIndex[dp];
      prevObj[varName] = null;
      lastObj[varName] = null;
    });

    let j = 0;
    let curdtx = arr[0].dtx;

    // Выбрать первое значение в каждом интервале
    const upValsArray = []; // промежуточный массив
    let res = {};
    while (j < arr.length) {
      if (curdtx == arr[j].dtx) {
        let dp = arr[j].dn + '.' + arr[j].prop;

        if (diffIndex[dp]) {
          const varName = diffIndex[dp];

          // Нужно только первое значение!!
          if (!res[varName]) {
            res[varName] = Number(arr[j].val);
          }
          lastObj[varName] = Number(arr[j].val); // самое последнее значение по этому счетчику
        }
        j++;
      } else {
        // Если по счетчику не было показаний за период - нужно взять последнее за предыдущий
        varNames.forEach(vname => {
          if (res[vname] == undefined) res[vname] = lastObj[vname];
        });
        prevObj = { ...prevObj, ...res };
        upValsArray.push({ curdtx: String(curdtx), ...prevObj });
        res = {};

        let nextDtx = transform(getNextTsFromDtx(curdtx, discrete), discrete);
        // Если есть временной пробел - нужно вставить lastObj,
        // И первое значение, которое будет дальше, нужно взять из lastObj
        if (nextDtx < arr[j].dtx) {
          res = { ...lastObj };
          prevObj = { ...lastObj };
          while (nextDtx < arr[j].dtx) {
            // Повторить показания
            upValsArray.push({ curdtx: String(nextDtx), ...prevObj });
            nextDtx = transform(getNextTsFromDtx(nextDtx, discrete), discrete);
          }
        }

        curdtx = arr[j].dtx;
      }
    }
    // Обход окончен - записать последний штатный элемент
    prevObj = { ...prevObj, ...res };
    upValsArray.push({ curdtx: String(curdtx), ...prevObj });

    // Также есть последнее значение - для расчета последней разницы ?
    upValsArray.push({ curdtx: 'last', ...lastObj });

    // Из массива начальных значений upValsArray сформировать массив расхода
    return createDiffMap(upValsArray, varNames);
  }

  // Из массива начальных значений upValsArray сформировать массив расхода
  function createDiffMap(upValsArray, varNames) {
    // const varNames = Object.keys(diffIndex).map(dp => diffIndex[dp]);
    for (let i = 0; i < upValsArray.length - 1; i++) {
      const ucurdtx = upValsArray[i].curdtx;
      const res = { curdtx: ucurdtx };
      varNames.forEach(vname => {
        res[vname] = upValsArray[i + 1][vname] - upValsArray[i][vname];
      });
      diffValsMap.set(ucurdtx, res);
    }
  }
};

// Частные функции

// Преобразовать в зависимости от дискреты
function transform(ts, discrete) {
  let dt = new Date(ts);
  let dtx = String(dt.getFullYear() - 2000);
  dtx += pad(dt.getMonth());
  if (discrete == 'month') return dtx;

  dtx += pad(dt.getDate());
  if (discrete == 'day') return dtx;

  dtx += pad(dt.getHours());
  if (discrete == 'hour') return dtx;

  dtx += pad(dt.getMinutes());
  return dtx;
}

function getTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;

  if (discrete == 'month') {
    dd = 1;
    hh = 0;
  } else {
    dd = Number(dtx.substr(4, 2));
    if (discrete == 'day') {
      hh = 0;
    } else {
      hh = Number(dtx.substr(6, 2));
      if (discrete == 'hour') {
        minutes = 0;
      } else {
        minutes = Number(dtx.substr(8, 2));
      }
    }
  }

  return new Date(yy, mm, dd, hh, minutes).getTime();
}

function getStartTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;

  if (discrete == 'month') {
    dd = 1;
    hh = 0;
  } else {
    dd = Number(dtx.substr(4, 2));
    if (discrete == 'day') {
      hh = 0;
    } else {
      hh = Number(dtx.substr(6, 2));
      if (discrete == 'hour') {
        minutes = 0;
      } else {
        minutes = Number(dtx.substr(8, 2));
      }
    }
  }

  return new Date(yy, mm, dd, hh, minutes).getTime();
}

function getNextTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;

  if (discrete == 'month') {
    dd = 1;
    hh = 0;
    // След месяц
    mm += 1;
    if (mm > 11) {
      mm = 0;
      yy += 1;
    }
  } else {
    dd = Number(dtx.substr(4, 2));
    if (discrete == 'day') {
      hh = 0;
      dd += 1;
    } else {
      hh = Number(dtx.substr(6, 2));
      if (discrete == 'hour') {
        minutes = 0;
        hh += 1;
      } else {
        minutes = Number(dtx.substr(8, 2));
        minutes += 1;
      }
    }
  }
  return new Date(yy, mm, dd, hh, minutes).getTime();
}

function getEndTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;

  if (discrete == 'month') {
    dd = 1;
    hh = 0;
    // След месяц
    mm += 1;
    if (mm > 11) {
      mm = 0;
      yy += 1;
    }
  } else {
    dd = Number(dtx.substr(4, 2));
    if (discrete == 'day') {
      hh = 0;
      dd += 1;
    } else {
      hh = Number(dtx.substr(6, 2));
      if (discrete == 'hour') {
        minutes = 0;
        hh += 1;
      } else {
        minutes = Number(dtx.substr(8, 2));
        minutes += 1;
      }
    }
  }
  return new Date(yy, mm, dd, hh, minutes).getTime() - 1000; // -1 сек
}

function pad(val, width) {
  let numAsString = val + '';
  width = width || 2;
  while (numAsString.length < width) {
    numAsString = '0' + numAsString;
  }
  return numAsString;
}
