/**
 * app.js
 */

const util = require('util');
const fs = require('fs');
// const path = require('path');

// const hut = require('./lib/hut');
// const scriptapi = require('./lib/scriptapi');
const trends = require('./lib/trends');

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
    console.log('Try client');
    const Client = require(sqlclientFilename);
    client = new Client(opt);

    console.log('client OK ');
    await client.connect();
    plugin.log('Connected to ' + agentName);
    console.log('Connected to ' + agentName);
  } catch (e) {
    console.log('Connection error: ' + util.inspect(e));
  }

  plugin.onCommand(async mes => reportRequest(mes));

  async function reportRequest(mes) {
    const respObj = { id: mes.id, type: 'command' };
    console.log('reportRequest mes='+util.inspect(mes))
    try {
      let res = {};

      if (mes.usescript) {
        // Запустить пользовательский обработчик
        // const filename = mes.uhandler;
        // if (!filename || !fs.existsSync(filename)) throw { message: 'Script file not found: ' + filename };

        let ts = Date.now();
        const oneH = 3600 * 1000;

        // hut.unrequire(filename);
        try {
          // res = await require(filename)(mes.reportVars, mes.devices, client, mes.filter, scriptapi);
          res = {
            items: [
              {
                id: 'VMETER001.value',
                points: [
                  { x: ts - oneH * 2, y: 10 },
                  { x: ts - oneH, y: 20 },
                  { x: ts, y: 30 }
                ],
                legend: 'Счетчик 1',
                dn_prop: 'VMETER002.value',
                fillColor: 'rgba(248,231,28,0.28)'
              },
              {
                id: 'VMETER002.value',
                points: [
                  { x: ts - oneH * 2, y: 15 },
                  { x: ts - oneH, y: 25 },
                  { x: ts, y: 35 }
                ],
                legend: 'Счетчик 2',
                dn_prop: 'VMETER002.value',

                fillColor: 'rgba(216,38,38,1)'
              }
            ],
            start: ts - oneH * 3,
            end: ts,
            min: 0,
            max: 50,
            unit: 'hour'
          };
        } catch (e) {
          plugin.log('Script error: ' + util.inspect(e));
          throw { message: 'Script error: ' + util.inspect(e) };
        }
      } else {
        res = await getRes(mes);
      }

      respObj.payload = res;
      respObj.response = 1;
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      respObj.error = e;
      respObj.response = 0;
    }
    plugin.log('SEND RESPONSE ' + util.inspect(respObj));
    console.log('SEND RESPONSE ' + util.inspect(respObj));

    plugin.send(respObj);
  }

  async function getRes(mes) {
    // Подготовить запрос или запрос уже готов
    const query = mes.sql || { ...mes.filter };
    if (query.end2) query.end = query.end2;

    const sqlStr = client.prepareQuery(query);
    plugin.log('SQL: ' + sqlStr);
    console.log('SQL: ' + sqlStr);

    // Выполнить запрос
    let arr = [];
    if (sqlStr) {
      arr = await client.query(sqlStr);
    }

    if (arr.length > 0) {
      plugin.log('SQL result len= ' + arr.length + ' First record: ' + util.inspect(arr[0]));
      console.log('SQL result len= ' + arr.length + ' First record: ' + util.inspect(arr[0]));
    } else {
      plugin.log('SQL result len=0');
      console.log('SQL result len=0');
    }

    // результат преобразовать 
    const dnarr = query.dn_prop.split(',');
    return trends.getResObject(arr, dnarr, mes);
  }

  
};
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