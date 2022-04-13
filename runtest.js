/**
 * runtest.js
 * - Запускает chartmaker как дочерний процесс
 * - Передает params
 * - Через 500 сек выполняет запрос из readObj
 */

const util = require('util');
const path = require('path');
const child = require('child_process');

const modulepath = path.resolve('./', 'index.js');
const opt = {
  database: 'test',
  logfile: path.resolve('./', 'ih_test_chartmaker.log'),
  lang: 'ru',
  loglevel: 0
};
const args = [JSON.stringify(opt)];
let ps = child.fork(modulepath, args);

if (!ps) {
  console.log('Child process run failed: '+modulepath);
  return;
}

const now = Date.now();
const readObj = {
  filter: {
  start: now - 50000,
  end: now,
  dn_prop: 'TEST1.value,TEST2.value',
  ids: '10,20'
  },
  columns:[{id:'TEST1.value', dn_prop:'TEST1.value' }, {id:'TEST2.value', dn_prop:'TEST2.value' }]
}
setTimeout(() => {
  ps.send({id:42, type:'command', ...readObj});
}, 500);

ps.on('close', code => {
  console.log('Child process has exited with code ' + code);
  process.exit();
});

ps.on('message', async m => {
  // console.log('Get message: ' + util.inspect(m));
  switch (m.type) {
    case 'get': 
    sendGetResponse(m);
    break;

    case 'command':
      // Получен ответ на запрос
      console.log('Response Payload: '+util.inspect(m.payload, null, 4));
      process.exit(0);
      break;
    default:
  }
});


function sendGetResponse(m) {
  let data;
  if (m.name == 'params') {
    const agentPath = path.resolve('./mock');
    data = { agentName: 'mock', agentPath, useIds: 1};
  }
  if (data) ps.send({id:m.id, type:'get', data, response: 1});
}