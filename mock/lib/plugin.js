/**
 * mockPlugin
 */

class Plugin {
  constructor(opt) {
    this.opt = opt;
  
  }
  log (text) {
    console.log('Plugin.log => '+text)
  }
}

module.exports = Plugin;