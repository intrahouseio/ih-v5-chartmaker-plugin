/**
 * runtest.js
 * - Запускает chartmaker как дочерний процесс
 * - Передает params
 * - C интервалом 500 мсек выполняет тестовые запросы 
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
  console.log('Child process run failed: ' + modulepath);
  return;
}

// Запустить несколько тестов с интервалом 
const tests = ['TEST1', 'METER1'];
let count = 0;
let done = 0;
setTimeout(nextTest, 1000);


function sendTest() {
  const readObj = getReadObj(count);
  console.log('count='+count+' readObj='+util.inspect(readObj))
  ps.send({ id: 42, type: 'command', ...readObj });
  count += 1;
  setTimeout(nextTest, 1000);
}

function nextTest() {
  if (count < tests.length) {
    sendTest();
  } else {
    console.log('Next test completed: '+count +' tests');
    process.exit();
  }
}


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
      console.log('Response Payload: ' + util.inspect(m.payload));
      done += 1;
      console.log('done='+done+' tests.length='+tests.length)
      if (tests.length <= done) {
        console.log(done+' tests completed')
        process.exit(0);
      }
      break;
    default:
  }
});

function sendGetResponse(m) {
  let data;
  if (m.name == 'params') {
    const agentPath = path.resolve('./mock');
    data = { agentName: 'mock', agentPath, useIds: 1 };
  }
  if (data) ps.send({ id: m.id, type: 'get', data, response: 1 });
}

function getReadObj(testIndex) {
  // const now = Date.now();
  const start = new Date(2022, 5, 22, 4).getTime();
  const end = new Date(2022, 5, 22, 8).getTime();

  switch (testIndex) {
    case 0:
      return {
        ids: '10,20',
        filter: {
          start,
          end,
          dn_prop: 'TEST1.value,TEST2.value',
          ids: '10,20'
        },
        columns: [
          { id: 'TEST1.value', dn_prop: 'TEST1.value' },
          { id: 'TEST2.value', dn_prop: 'TEST2.value' }
        ]
      };

    case 1:
      return {
        ids: '10,20',
        process_type:'afun',
        discrete: 'hour',
        dkoeff:2,
        calc_fun: 'diff',
        end2: end + 3600*1000,
        filter: {
          start,
          end,
          end2: end + 3600*1000,
          dn_prop: 'METER1.value,METER2.value',
          ids: '10,20'
        },
        columns: [
          { id: 'METER1.value', dn_prop: 'METER1.value' },
          { id: 'METER2.value', dn_prop: 'METER2.value' }
        ]
      };

    default:   
  }
}
