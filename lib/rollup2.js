/**
 * rollup.js
 * Свертка массива, полученного из БД, для графиков
 * 
 */

// const util = require('util');


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
 * @return {Array of Object} - { items:{points: [{x,y}], ...colItem, id: dn_prop} , min, max, start, end, unit: discrete }
 */
module.exports = function rollup(arr, readobj) {
  const discrete = readobj.discrete;
  const dkoeff = readobj.dkoeff; // Множитель дискреты
  const start = readobj.filter.start;
  const end = readobj.filter.end;
  
  const reportVars = readobj.columns;
  const calc_fun = readobj.calc_fun;
  let min = 0;
  let max = 0;

  const reportEnd = readobj.end; // Для diff вытаскиваем на 1 дискрету больше
  
  if (!Array.isArray(arr) || !arr.length || !reportVars || !Array.isArray(reportVars)) {
    return { items: []};
  }


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

  const shift = dkoeff > 1 ? getDiscreteMs(discrete) * dkoeff : 0;
  if (shift) {
    createResultWithBucket(shift);
  } else {
    createResult();
  }

  // Из объекта нужно сделать массив!!
  // Если данных нет - item все равно должен быть, хотя бы пустой
  const resArr = [];
  readobj.columns.forEach(colItem => {
    const dn_prop = colItem.dn_prop;
    const decdig = getDecdig( colItem.decdig);
    const item = { points: [], ...colItem, id: dn_prop };
    if (result[dn_prop]) {
      item.points = result[dn_prop].points.map(p => ({x:p.x, y: Number(p.y.toFixed(decdig))}));
    }
    resArr.push(item);
  });
  return { items: resArr, min, max, start, end, unit: discrete };


  function getDecdig(decdig = 0) {
    const d = parseInt(decdig);
    return d <= 0 || d > 16 ? 0 : d;
  
  }
  // 
  function createResultWithBucket(ashift) {
    let j = 0;
    let curdtx = arr[j].dtx;
    let startBucket = start;
    let nextBucket = getNextBucketTs(startBucket, getEndTsFromDtx(curdtx, discrete), ashift);

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
        if (getEndTsFromDtx(arr[j].dtx, discrete) >= nextBucket) {
          console.log(' nextBucket=' + nextBucket + ' arr[j].dtx=' + arr[j].dtx);
          // { startTs: nextBucket - shift, endTs: nextBucket - 1 }
          // const one = getOneRowObjWithBucket({ startTs: nextBucket - shift, endTs: nextBucket - 1 });
          addPoints(nextBucket - shift, nextBucket - 1);

          nextBucket = getNextBucketTs(nextBucket, getEndTsFromDtx(arr[j].dtx, discrete), ashift);
          console.log(' nextBucket=' + nextBucket + ' curdtx=' + curdtx + ' ashift=' + ashift);
          vals = {};
          counts = {};
        }
        curdtx = arr[j].dtx;
      }
    }
    addPoints(nextBucket - shift, nextBucket - 1);
  }

  function getNextBucketTs(sts, cts, ashift) {
    let next = sts;
    while (cts > next) {
      next += ashift;
    }
    return next;
  }

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
        addPoints(getX(curdtx));
        vals = {};
        counts = {};
        curdtx = arr[j].dtx;
      }
    }
    addPoints(getX(curdtx));
  }

  function getX(curx) {
    return discrete ? getTsFromDtx(curx, discrete) : curx;
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

  function addPoints(x, endTs) {
    /*
    let x= curdtx;
    if (discrete) {
      x = getStartTsFromDtx(curdtx, discrete);
    } else x = curdtx;
    */

    let y = NaN;
    reportVars.forEach(item => {
      if (item.calc_type == 'avg') {
        y = counts[item.dn_prop] > 0 ? vals[item.dn_prop] / counts[item.dn_prop] : '';
      } else if (item.calc_type == 'diff') {
        // для bucket - нужно суммировать
        y = getDiff(item.dn_prop, x, endTs);
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

  function getDiff(dn_prop, startTs, endTs) {
    // Нужно сложить все расходы за bucket из diffValsMap
    const startDtx = transform(startTs, discrete);
    if (!endTs) {
      const dItem = diffValsMap.get(startDtx) || 0;
      return dItem ? dItem[dn_prop] : 0;
    }

    const endDtx = transform(endTs, discrete);
    let val = 0;
    for (const [dtx, dItem] of diffValsMap) {
      if (dtx >= startDtx && dtx <= endDtx) {
        val += dItem[dn_prop];
      }
    }
    return val;
  }

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
  console.log(' getStartTsFromDtx dtx=' + dtx);
  dtx = String(dtx);
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

function getDiscreteMs(discrete) {
  const oneMin = 60000;
  switch (discrete) {
    case 'minute':
    case 'min':
      return oneMin;
    case 'hour':
      return oneMin * 60;
    case 'day':
      return oneMin * 60 * 24;
    default:
  }
}
