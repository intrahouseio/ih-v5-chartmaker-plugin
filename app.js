/**
 * app.js
 */

const util = require('util');
const fs = require('fs');

// const hut = require('./lib/hut');
// const scriptapi = require('./lib/scriptapi');
const trends = require('./lib/trends');
const rollup = require('./lib/rollup');

module.exports = async function(plugin) {
  const { agentName, agentPath, customFolder, ...opt } = plugin.params.data;
  console.log('Start chartmaker ');

  // Путь к пользовательским таблицам
  // scriptapi.customFolder = customFolder;

  // Подключиться к БД
  const sqlclientFilename = agentPath + '/lib/sqlclient.js';
  console.log('Try chartmaker ' + sqlclientFilename);
  if (!fs.existsSync(sqlclientFilename)) {
    console.log('File not found ' + sqlclientFilename);
    // throw { message: 'File not found: ' + sqlclientFilename };
  }

  let client;
  try {
    const Client = require(sqlclientFilename);
    client = new Client(opt);
    await client.connect();
    plugin.log('Connected to ' + agentName);
  } catch (e) {
    console.log('Connection error: ' + util.inspect(e));
  }

  plugin.onCommand(async mes => reportRequest(mes));

  async function reportRequest(mes) {
    const respObj = { id: mes.id, type: 'command' };
    console.log('reportRequest mes=' + util.inspect(mes));
    try {
      let res = {};

      if (mes.usescript) {
        // Запустить пользовательский обработчик
        const filename = mes.uhandler;
        if (!filename || !fs.existsSync(filename)) throw { message: 'Script file not found: ' + filename };

        unrequire(filename);
        try {
          res = await require(filename)();
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

    const sqlStr = client.prepareQuery(query);
    plugin.log('SQL: ' + sqlStr);

    // Выполнить запрос
    let arr = [];
    if (sqlStr) arr = await client.query(sqlStr);

    // результат преобразовать
    return mes.process_type == 'afun' ? rollup(arr, mes) : trends(arr, mes);
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
