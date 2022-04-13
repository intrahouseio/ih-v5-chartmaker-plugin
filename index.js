const util = require('util');
const plugin = require('ih-plugin-api')();

const app = require('./app');

console.log('Chartmaker plugin has started.');

(async () => {
  // console.log('Chartmaker plugin has started.');
  plugin.log('Chartmaker plugin has started.', 0);
  try {
    // if (!plugin.params.agentPath) throw { message: 'No agentPath!' };
    plugin.params.data = await plugin.params.get();

    // console.log('Received params ' + JSON.stringify(plugin.params.data));
    // if (!plugin.params.agentPath) throw { message: 'No agentPath!' };

    app(plugin);
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    plugin.log('ERROR: ' + util.inspect(e));
    setTimeout(() => {
      plugin.exit(1);
    }, 1000);
  }
})();
