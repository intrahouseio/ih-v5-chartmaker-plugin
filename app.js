/**
 * app.js
 */

const util = require('util');
const fs = require('fs');

const trends = require('./lib/trends');
const rollup = require('./lib/rollup2');
const piedata = require('./lib/piedata');

module.exports = async function(plugin) {
  const { agentName, agentPath, customFolder, jbaseFolder, useIds, ...opt } = plugin.params.data;
  plugin.apimanager.start(plugin, { customFolder, jbaseFolder, useIds });

  // Путь к пользовательским таблицам
  // scriptapi.customFolder = customFolder;

  // Подключиться к БД
  const sqlclientFilename = agentPath + '/lib/sqlclient.js';
  if (!fs.existsSync(sqlclientFilename)) {
    throw { message: 'File not found: ' + sqlclientFilename };
  }

  let client;
  try {
    const Client = require(sqlclientFilename);
    client = new Client(opt);
    await client.connect();
    plugin.log('Connected to ' + agentName);
  } catch (e) {
    throw { message: 'Connection error: ' + util.inspect(e) };
  }

  plugin.onCommand(async mes => processCommand(mes));

  async function processCommand(mes) {
    let respObj = { id: mes.id, type: 'command' };
    const uuid = mes.debug_uuid;
    // console.log('Request Message: ' + util.inspect(mes));
    try {
      let res = {};

      if (mes.usescript) {
        // Запустить пользовательский обработчик
        const filename = mes.uhandler;
        if (!filename || !fs.existsSync(filename)) throw { message: 'Script file not found: ' + filename };

        unrequire(filename);
        let txt = '';
        try {
          txt = 'Start';
          debug(txt);
          res = await require(filename)(mes, client, plugin.apimanager, debug);
          txt = 'Stop\n result =  ' + util.inspect(res);
          debug(txt);
          if (!res) throw { err: 'NORESULT', message: 'No result from script!' };
          if (res.err) throw { err: res.err, message: res.err };
        } catch (e) {
          let errmsg;
          if (e.err) {
            errmsg = e.message || e.err;
          } else {
            errmsg = 'Script error: ' + util.inspect(e);
          }
          plugin.log(errmsg);
          debug(errmsg);

          throw { message: errmsg };
        }
      } else {
        res = await getRes(mes);
        if (mes.chart_type == 'chartcolumns') {
          res.stacked = mes.stacked || 0;
          res.autoskip = mes.autoskip || 0;
        }
        if (!res.scales && mes.scales) res.scales = mes.scales;

        res.scalestacked = mes.scalestacked || 0;
      }
      if (!res.formats) res.formats = mes.formats || {};
      if (mes.now) res.now = mes.now;

      respObj.payload = res;
      respObj.response = 1;
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      respObj.error = e;
      respObj.response = 0;
    }
    plugin.log('SEND RESPONSE ' + util.inspect(respObj), 1);
    plugin.send(respObj);
    respObj = '';

    function debug(msg) {
      if (typeof msg == 'object') msg = util.inspect(msg, null, 4);
      plugin.send({ type: 'debug', txt: msg, uuid });
    }
  }

  async function getRes(mes) {
    // Подготовить запрос или запрос уже готов
    const query = mes.sql || { ...mes.filter };
    if (typeof query == 'object') {
      if (query.end2) query.end = query.end2;
      query.ids = mes.ids;
      if (mes.process_type == 'afun' || mes.chart_type == 'chartpie' || mes.chart_type == 'chartcolumns') {
        query.notnull = true; // Может также быть для неагрегированного (линейного) - если без разрывов
      }
    }

    let arr = [];
    try {
      arr = await queryPointsFromDB(query);
      if (arr.length == 0 ) {
        // Нет ни одной записи - получить последнюю точку и вернуть ее в момент старт
        // arr = await queryOverpastPointFromDB(query);
        // Временно скрыть этот функционал, так как в чанках работает некорректно
      } else {
        plugin.log('Records: ' + arr.length);
      }

      // Выполнить обратный маппинг id => dn, prop
      if (useIds) {
        arr = remap(arr, query);
      }
    } catch (e) {
      plugin.log('ERROR: ' +e && e.message ? e.message : util.inspect(e));
      arr = [];
    }

    /*
    const sqlStr = client.prepareQuery(query, useIds); // Эта функция должна сформировать запрос с учетом ids
    plugin.log('SQL: ' + sqlStr);

    // Выполнить запрос
    let arr = [];
 
      if (sqlStr) {
        arr = await client.query(sqlStr);
        // Выполнить обратный маппинг id => dn, prop
        if (useIds) {
          arr = remap(arr, query);
        }
      }
      */

    // результат преобразовать
    if (mes.process_type == 'afun') return rollup(arr, mes);
    if (mes.chart_type == 'chartpie') return piedata(arr, mes);
    return trends(arr, mes);
  }

  async function queryPointsFromDB(query) {
    const sqlStr = client.prepareQuery(query, useIds); // Эта функция должна сформировать запрос с учетом ids
    plugin.log('queryPointsFromDB SQL: ' + sqlStr);
    if (!sqlStr) throw { message: 'prepareQuery for query: ' + util.inspect(query) + ' is empty' };

    try {
      return client.query(sqlStr);
    } catch (e) {
      throw { message: 'Query rejected for SQL: ' + sqlStr };
    }
  }

  async function queryOverpastPointFromDB(query) {
    const q1 = { ...query, start: 0, end: query.start };
    let sqlStr = client.prepareQuery(q1, useIds); // Эта функция должна сформировать запрос с учетом ids
    if (!sqlStr) throw { message: 'prepareQuery OverpastPoint query: ' + util.inspect(q1) + ' is empty' };

    sqlStr += ' LIMIT 1';
    plugin.log('getLastPoint: ' + sqlStr);
    try {
      const one = await client.query(sqlStr);
      if (!one.length) {
        plugin.log('Not found last point');
        return [];
      }

      plugin.log('Found last point: ' + util.inspect(one));
      one[0].ts = query.start;
      return one;
    } catch (e) {
      throw { message: 'Query rejected for SQL: ' + sqlStr };
    }
  }

  async function queryOne(qstr, idx) {
    const xres = await client.query(qstr);
    plugin.log(idx + ' queryOne LEN=' + xres.length);
    return idx ? [] : xres;
  }

  function remap(arr, query) {
    if (!query.ids || !query.dn_prop) return arr;

    const idArr = query.ids.split(',');
    const dnArr = query.dn_prop.split(',');
    if (idArr.length != dnArr.length) return arr;

    const idMap = {};
    try {
      for (let i = 0; i < idArr.length; i++) {
        const intId = Number(idArr[i]);
        const [dn, prop] = dnArr[i].split('.');
        idMap[intId] = { dn, prop };
      }
      arr.forEach(item => {
        if (item.id && idMap[item.id]) {
          Object.assign(item, idMap[item.id]);
        }
      });
    } catch (e) {
      plugin.log('Remap error for query.ids=' + query.ids + ' query.dn_prop=' + query.dn_prop + ' : ' + util.inspect(e));
    }
    return arr;
  }
};

function unrequire(moduleName) {
  if (!moduleName) return;
  try {
    const fullPath = require.resolve(moduleName);
    delete require.cache[fullPath];
  } catch (e) {
    // Может и не быть
  }
}

/**
 * mes={
  start: 1648587600000,
  end: 1648715915518,
  dn_prop: 'VMETER001.value',
  target: 'trend',
  oldFormat: 0,
  chart_type: 'chartlines',
  process_type: '-',
  columns: [
    {
      id: 'gmYF3_cvb',
      legend: '',
      dn_prop: 'VMETER001.value',
      lineColor: 'rgba(208,2,27,1)',
      fillMode: 'none',
      fillColor: '',
      lineWidth: '2',
      interpolation: 'default'
    }
  ],
  filter: {
    start: 1648587600000,
    end: 1648715915518,
    dn_prop: 'VMETER001.value'
  },
  command: 'report',
  targetFolder: '/var/lib/intrahouse-d/projects/yrus_fromberry_22/temp',
  id: 'jkZ9DfHDE',
  type: 'command'
}

 */
