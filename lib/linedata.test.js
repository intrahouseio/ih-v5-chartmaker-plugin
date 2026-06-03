/* eslint-disable */

const util = require('util');
const assert = require('assert');

const linedata = require('./linedata');
const MockClient = require('../mock/lib/sqlclient');
const Plugin = require('../mock/lib/plugin');

const client = new MockClient({});
const plugin = new Plugin({});
plugin.log = jest.fn();

describe('linedata', () => {
  describe('linedata, one chart, No records, Step interpolation', () => {
    const now = 1780148700000;
    const start = now - 30000;
    const end = now;
    const recs = [];
    const readobj = { edge: 1, columns: [{ dn_prop: 'AI_001.value', interpolation: 'step' }], filter: { start, end } };
    const query = { start, end };

    test('WHEN данных внутри периода и слева нет, THEN вернуть пустой массив', async () => {
      let theSql = '';
      jest.spyOn(client, 'query').mockImplementation(sqlStr => {
        theSql = sqlStr;
        return Promise.resolve([]);
      });

      let errorLog = '';
      plugin.log.mockImplementation(txt => {
        if (txt && txt.indexOf('ERROR') >= 0) errorLog = txt;
      });

      const res = await linedata(recs, readobj, query, false, client, plugin);

      let checkSql = checkSqlStrForNeabyPoint(theSql, ["'AI_001'", "'value'", 'ts <= ' + start]);
      expect(checkSql).toBe('');
      expect(errorLog).toBe('');
      expect(typeof res).toBe('object');
      expect(typeof res.items).toBe('object');
      expect(res.items.length).toBe(1);
      expect(res.items[0].points.length).toBe(0);
    });

    test('WHEN данных внутри периода нет, точка слева есть, THEN вернуть 2 точки ', async () => {
      let theSql = '';
      jest.spyOn(client, 'query').mockImplementation(sqlStr => {
        theSql = sqlStr;
        return Promise.resolve([{ dn: 'AI_001', prop: 'value', val: 42, ts: start - 10000 }]);
      });

      let errorLog = '';
      plugin.log.mockImplementation(txt => {
        if (txt && txt.indexOf('ERROR') >= 0) errorLog = txt;
      });

      const res = await linedata(recs, readobj, query, false, client, plugin);

      let checkSql = checkSqlStrForNeabyPoint(theSql, ["'AI_001'", "'value'", 'ts <= ' + start]);
      expect(checkSql).toBe('');
      expect(errorLog).toBe('');
      expect(typeof res).toBe('object');
      expect(typeof res.items).toBe('object');
      expect(res.items.length).toBe(1);
      expect(res.items[0].points.length).toBe(2);
      const points = res.items[0].points;
      expect(points[0].x).toBe(start);
      expect(points[0].y).toBe(42);
      expect(points[0].hide).toBe(1);
      expect(points[1].x).toBe(end);
      expect(points[1].y).toBe(42);
      expect(points[1].hide).toBe(1);
    });
  });

  describe('linedata, one chart, No records, Default interpolation', () => {
    const now = 1780148700000;
    const start = now - 30000;
    const end = now;
    const recs = [];
    const readobj = { edge: 1, columns: [{ dn_prop: 'AI_001.value', interpolation: 'default' }], filter: { start, end } };
    const query = { start, end };

    test('WHEN данных внутри периода и слева нет, THEN вернуть пустой массив', async () => {
      let theSql = '';
      jest.spyOn(client, 'query').mockImplementation(sqlStr => {
        theSql = sqlStr;
        return Promise.resolve([]);
      });

      let errorLog = '';
      plugin.log.mockImplementation(txt => {
        if (txt && txt.indexOf('ERROR') >= 0) errorLog = txt;
      });

      const res = await linedata(recs, readobj, query, false, client, plugin);

      let checkSql = checkSqlStrForNeabyPoint(theSql, ["'AI_001'", "'value'", 'ts <= ' + start]);
      expect(checkSql).toBe('');
      expect(errorLog).toBe('');
      expect(typeof res).toBe('object');
      expect(typeof res.items).toBe('object');
      expect(res.items.length).toBe(1);
      expect(res.items[0].points.length).toBe(0);
    });

    test('WHEN данных внутри периода нет, точка слева есть, точки справа нет, THEN вернуть 2 точки (продлить левую)', async () => {
      let theSql1 = '';
      let theSql2 = '';
      jest.spyOn(client, 'query').mockImplementation(sqlStr => {
        if (sqlStr.indexOf('ts <=') > 0) {
          theSql1 = sqlStr;
          return Promise.resolve([{ dn: 'AI_001', prop: 'value', val: 42, ts: start - 10000 }]);
        }
        if (sqlStr.indexOf('ts >=') > 0) {
          theSql2 = sqlStr;
          return Promise.resolve([]);
        }
      });

      let errorLog = '';
      plugin.log.mockImplementation(txt => {
        if (txt && txt.indexOf('ERROR') >= 0) errorLog = txt;
      });

      const res = await linedata(recs, readobj, query, false, client, plugin);

      // let checkSql = checkSqlStrForNeabyPoint(theSql, ["'AI_001'", "'value'", 'ts <= ' + start]);
      expect(theSql1).not.toBe('');
      expect(theSql2).not.toBe('');

      expect(errorLog).toBe('');
      expect(typeof res).toBe('object');
      expect(typeof res.items).toBe('object');
      expect(res.items.length).toBe(1);
      expect(res.items[0].points.length).toBe(2);
      const points = res.items[0].points;
      expect(points[0].x).toBe(start);
      expect(points[0].y).toBe(42);
      expect(points[0].hide).toBe(1);
      expect(points[1].x).toBe(end);
      expect(points[1].y).toBe(42);
      expect(points[1].hide).toBe(1);
    });

    test('WHEN данных внутри периода нет, точка слева есть, точка справа есть, THEN вернуть 2 точки (интерполяция через left, right)', async () => {
      let theSql1 = '';
      let theSql2 = '';
      jest.spyOn(client, 'query').mockImplementation(sqlStr => {
        if (sqlStr.indexOf('ts <=') > 0) {
          theSql1 = sqlStr;
          return Promise.resolve([{ dn: 'AI_001', prop: 'value', val: 1, ts: start - 10000 }]);
        }
        if (sqlStr.indexOf('ts >=') > 0) {
          theSql2 = sqlStr;
          return Promise.resolve([{ dn: 'AI_001', prop: 'value', val: 6, ts: end + 10000 }]);
        }
      });

      let errorLog = '';
      plugin.log.mockImplementation(txt => {
        if (txt && txt.indexOf('ERROR') >= 0) errorLog = txt;
      });

      const res = await linedata(recs, readobj, query, false, client, plugin);

      // let checkSql = checkSqlStrForNeabyPoint(theSql, ["'AI_001'", "'value'", 'ts <= ' + start]);
      expect(theSql1).not.toBe('');
      expect(theSql2).not.toBe('');
      // console.log('theSql1 '+theSql1)
      // console.log('theSql2 '+theSql2)
      expect(errorLog).toBe('');
      expect(typeof res).toBe('object');
      expect(typeof res.items).toBe('object');
      expect(res.items.length).toBe(1);
      expect(res.items[0].points.length).toBe(2);
      const points = res.items[0].points;
      expect(points[0].x).toBe(start);
      expect(points[0].y).toBe(2);
      expect(points[0].hide).toBe(1);
      expect(points[1].x).toBe(end);
      expect(points[1].y).toBe(5);
      expect(points[1].hide).toBe(1);
    });
  });

  describe('linedata, one chart, Records found, Step interpolation', () => {
    const now = 1780148700000;
    const start = now - 30000;
    const end = now;
    const recs = [
      { dn: 'AI_001', prop: 'value', ts: start + 10000, val: 1 },
      { dn: 'AI_001', prop: 'value', ts: start + 20000, val: 2 }
    ]; // 2 точки внутри
    const readobj = { edge: 1, columns: [{ dn_prop: 'AI_001.value', interpolation: 'step' }], filter: { start, end } };
    const query = { start, end };

    test('WHEN данные внутри периода есть, слева точка есть, THEN вернуть данные + левая в точке(start) плюс продлить последнюю в end ', async () => {
      let theSql = '';
      jest.spyOn(client, 'query').mockImplementation(sqlStr => {
        theSql = sqlStr;
        return Promise.resolve([{ dn: 'AI_001', prop: 'value', val: 9, ts: start - 10000 }]);
      });

      let errorLog = '';
      plugin.log.mockImplementation(txt => {
        if (txt && txt.indexOf('ERROR') >= 0) errorLog = txt;
      });

      const res = await linedata(recs, readobj, query, false, client, plugin);

      let checkSql = checkSqlStrForNeabyPoint(theSql, ["'AI_001'", "'value'", 'ts <= ' + start]);
      expect(checkSql).toBe('');
      expect(errorLog).toBe('');
      expect(typeof res).toBe('object');
      expect(typeof res.items).toBe('object');
      expect(res.items.length).toBe(1);
      expect(res.items[0].points.length).toBe(4);

      const points = res.items[0].points;
      expect(points[0].x).toBe(start);
      expect(points[1].x).toBe(start + 10000);
      expect(points[2].x).toBe(start + 20000);
      expect(points[3].x).toBe(end);

      expect(points[0].hide).toBe(1);
      expect(points[1].hide).not.toBe(1);
      expect(points[2].hide).not.toBe(1);
      expect(points[3].hide).toBe(1);

      expect(points[0].y).toBe(9);
      expect(points[1].y).toBe(1);
      expect(points[2].y).toBe(2);
      expect(points[3].y).toBe(2); // step - должна продлиться последняя точка данных
    });

    test('WHEN данные внутри периода есть, слева точки нет, THEN вернуть данные, левую не добавлять плюс продлить последнюю в end ', async () => {
      let theSql = '';
      jest.spyOn(client, 'query').mockImplementation(sqlStr => {
        theSql = sqlStr;
        return Promise.resolve([]); // точки слева нет
      });

      let errorLog = '';
      plugin.log.mockImplementation(txt => {
        if (txt && txt.indexOf('ERROR') >= 0) errorLog = txt;
      });

      const res = await linedata(recs, readobj, query, false, client, plugin);

      let checkSql = checkSqlStrForNeabyPoint(theSql, ["'AI_001'", "'value'", 'ts <= ' + start]);
      expect(checkSql).toBe('');
      expect(errorLog).toBe('');
      expect(typeof res).toBe('object');
      expect(typeof res.items).toBe('object');
      expect(res.items.length).toBe(1);
      expect(res.items[0].points.length).toBe(3);

      const points = res.items[0].points;
      expect(points[0].x).toBe(start + 10000);
      expect(points[1].x).toBe(start + 20000);
      expect(points[2].x).toBe(end);

      expect(points[0].hide).not.toBe(1);
      expect(points[1].hide).not.toBe(1);
      expect(points[2].hide).toBe(1);

      expect(points[0].y).toBe(1);
      expect(points[1].y).toBe(2);
      expect(points[2].y).toBe(2); // step - должна продлиться последняя точка данных
    });
  });

  describe('linedata, one chart, Records found, Default interpolation', () => {
    const now = 1780148700000;
    const start = now - 30000;
    const end = now;
    const recs = [
      { dn: 'AI_001', prop: 'value', ts: start + 10000, val: 3 },
      { dn: 'AI_001', prop: 'value', ts: start + 20000, val: 2 }
    ]; // 2 точки внутри
    const readobj = { edge: 1, notnull: true, columns: [{ dn_prop: 'AI_001.value', interpolation: 'default' }], filter: { start, end } };
    const query = { start, end };
    
    test.only(
      'WHEN данные внутри периода есть, слева точка есть, справа есть, ' +
        'THEN вернуть данные + start, end с учетом интерполяции ',
      async () => {
        let theSql1 = '';
        let theSql2 = '';

        jest.spyOn(client, 'query').mockImplementation(sqlStr => {
          if (sqlStr.indexOf('ts <=') > 0) {
            theSql1 = sqlStr;
            // console.log('theSql1 = '+theSql1);
            return Promise.resolve([{ dn: 'AI_001', prop: 'value', val: 1, ts: start - 10000 }]);
          }
          if (sqlStr.indexOf('ts >=') > 0) {
            theSql2 = sqlStr;
            // console.log('theSql2 = '+theSql2);
            return Promise.resolve([{ dn: 'AI_001', prop: 'value', val: 0, ts: end + 10000 }]);
          }
        });

        let errorLog = '';
        plugin.log.mockImplementation(txt => {
          if (txt && txt.indexOf('ERROR') >= 0) errorLog = txt;
        });

        const res = await linedata(recs, readobj, query, false, client, plugin);

        expect(theSql1).not.toBe('');
        expect(theSql2).not.toBe('');
        expect(errorLog).toBe('');

        expect(typeof res).toBe('object');
        expect(typeof res.items).toBe('object');
        expect(res.items.length).toBe(1);
        expect(res.items[0].points.length).toBe(4);

        const points = res.items[0].points;
        expect(points[0].x).toBe(start);
        expect(points[1].x).toBe(start + 10000);
        expect(points[2].x).toBe(start + 20000);
        expect(points[3].x).toBe(end);

        expect(points[0].hide).toBe(1);
        expect(points[1].hide).not.toBe(1);
        expect(points[2].hide).not.toBe(1);
        expect(points[3].hide).toBe(1);

        expect(points[0].y).toBe(2);
        expect(points[1].y).toBe(3);
        expect(points[2].y).toBe(2);
        expect(points[3].y).toBe(1);
      }
    );
    

    test(
      'WHEN данные внутри периода есть, слева точки нет, справа есть' +
        'THEN вернуть данные, левую не добавлять, справа интерполяция в end ',
      async () => {
        let theSql1 = '';
        let theSql2 = '';
        jest.spyOn(client, 'query').mockImplementation(sqlStr => {
          if (sqlStr.indexOf('ts <=') > 0) {
            theSql1 = sqlStr;
            return Promise.resolve([]);
          }
          if (sqlStr.indexOf('ts >=') > 0) {
            theSql2 = sqlStr;
            return Promise.resolve([{ dn: 'AI_001', prop: 'value', val: 0, ts: end + 10000 }]);
          }
        });
        let errorLog = '';
        plugin.log.mockImplementation(txt => {
          if (txt && txt.indexOf('ERROR') >= 0) errorLog = txt;
        });

        const res = await linedata(recs, readobj, query, false, client, plugin);

        expect(theSql1).not.toBe('');
        expect(theSql2).not.toBe('');
        expect(errorLog).toBe('');

        expect(typeof res).toBe('object');
        expect(typeof res.items).toBe('object');
        expect(res.items.length).toBe(1);
        expect(res.items[0].points.length).toBe(3);

        const points = res.items[0].points;

        expect(points[0].x).toBe(start + 10000);
        expect(points[1].x).toBe(start + 20000);
        expect(points[2].x).toBe(end);

        expect(points[0].hide).not.toBe(1);
        expect(points[1].hide).not.toBe(1);
        expect(points[2].hide).toBe(1);

        expect(points[0].y).toBe(3);
        expect(points[1].y).toBe(2);
        expect(points[2].y).toBe(1);
      }
    );
  });
});

// select * from records  WHERE  dn = 'AI_001' AND prop = 'value'  AND  ts <= 1780148670000 order by ts DESC LIMIT 1
function checkSqlStrForNeabyPoint(sqlStr, incudeSubstr) {
  let checkSql = '';
  if (!sqlStr.startsWith('select * from records  WHERE')) {
    checkSql += 'Expect sqlStr startsWith "select * from records  WHERE" ';
  }
  if (!sqlStr.endsWith('order by ts DESC LIMIT 1')) {
    checkSql += 'Expect sqlStr endsWith "order by ts DESC LIMIT 1" ';
  }
  if (incudeSubstr && incudeSubstr.length) {
    incudeSubstr.forEach(substr => {
      if (sqlStr.indexOf(substr) <= 0) checkSql += 'Expect sqlStr includes "' + substr + '" ';
    });
  }
  return checkSql;
}
