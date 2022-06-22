/**
 * app.js
 */

const util = require('util');
const fs = require('fs');

// const hut = require('./lib/hut');
// const scriptapi = require('./lib/scriptapi');
const trends = require('./lib/trends');
const rollup = require('./lib/rollup');
const piedata = require('./lib/piedata');


module.exports = async function(plugin) {
  const { agentName, agentPath, customFolder, useIds, ...opt } = plugin.params.data;

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

  plugin.onCommand(async mes => process(mes));

  async function process(mes) {
    const respObj = { id: mes.id, type: 'command' };
    // console.log('Request Message: ' + util.inspect(mes));
    try {
      let res = {};

      if (mes.usescript) {
        // Запустить пользовательский обработчик
        const filename = mes.uhandler;
        if (!filename || !fs.existsSync(filename)) throw { message: 'Script file not found: ' + filename };

        unrequire(filename);
        try {
          res = await require(filename)(mes);
        } catch (e) {
          plugin.log('Script error: ' + util.inspect(e));
          throw { message: 'Script error: ' + util.inspect(e) };
        }
      } else {
        res = await getRes(mes);

        // добавить форматы временных меток - пользователь мог поменять!!
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
    plugin.log('SEND RESPONSE ' + util.inspect(respObj));
    plugin.send(respObj);
  }

  async function getRes(mes) {
    // Подготовить запрос или запрос уже готов
    const query = mes.sql || { ...mes.filter };
    if (query.end2) query.end = query.end2;
    query.ids = mes.ids;

    const sqlStr = client.prepareQuery(query, useIds); // Эта функция должна сформировать запрос с учетом ids
    plugin.log('SQL: ' + sqlStr);

    // Выполнить запрос
    let arr = [];
    if (sqlStr) {
      arr = await client.query(sqlStr);
      // console.log('Records: ' + util.inspect(arr));

      // Выполнить обратный маппинг id => dn, prop
      if (useIds) {
        arr = remap(arr, query);
        // console.log('Records after remap: ' + util.inspect(arr));
      }
    }

    // результат преобразовать
    // return mes.process_type == 'afun' ? rollup(arr, mes) : trends(arr, mes);
    // chart_type
    if (mes.process_type == 'afun') return rollup(arr, mes);
    if (mes.chart_type == 'chartpie') return piedata(arr, mes);
    return trends(arr, mes);

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
      plugin.log(
        'Remap error for query.ids=' + query.ids + ' query.dn_prop=' + query.dn_prop + ' : ' + util.inspect(e)
      );
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
