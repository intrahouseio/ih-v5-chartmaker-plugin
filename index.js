const util = require('util');
// const plugin = require('ih-plugin-api')();

const app = require('./app');

console.log('Chartmaker plugin has started.');

(async () => {
  let plugin;
  try {
    const opt = getOptFromArgs();
    const pluginapi = opt && opt.pluginapi ? opt.pluginapi : 'ih-plugin-api';
    console.log('pluginapi = '+pluginapi)
    plugin = require(pluginapi)();
    // console.log('Chartmaker plugin has started.');
    plugin.log('Chartmaker plugin has started.', 0);

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

function getOptFromArgs() {
  let opt;
  try {
    opt = JSON.parse(process.argv[2]); //
  } catch (e) {
    opt = {};
  }
  return opt;
}
