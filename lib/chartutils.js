/**
 * chartutils.js
 */

const util = require('util');

 exports.getPointAtX = getPointAtX;

 /**
 * Возвращает точку {x, y} на прямой между p1 и p2 по заданному x
 * @param {Object} p1 - первая точка {x, y}
 * @param {Object} p2 - вторая точка {x, y}
 * @param {number} x - значение x
 * @returns {Object} точка {x, y}
 */
function getPointAtX(p1, p2, x) {
  const args = 'p1='+util.inspect(p1)+'  p2='+util.inspect(p2);
  if (!p1 || !p2 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' ||
      typeof p2.x === 'undefined' || typeof p2.y === 'undefined') {

      throw new Error('getPointAtX: точки p1, p2 должны содержать свойства x и y: '+args);
  }

  const x1 = Number(p1.x);
  const y1 = Number(p1.y);
  const x2 = Number(p2.x);
  const y2 = Number(p2.y);
  x = Number(x);

  if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || isNaN(x)) {
      throw new Error('getPointAtX: все координаты должны быть числами: '+args);
  }

  if (x2 === x1) {
      console.log('getPointAtX: вертикальная линия');
      return { x: x1, y: (y1 + y2) / 2 };
  }

  const y = y1 + (y2 - y1) * (x - x1) / (x2 - x1);

  return { x, y };
}