'use nodent-promises';

module.exports = function(nodent) {
  var loaded = await require('loader-module')() ;
  var self = {version: nodent.version, options:__nodent} ;
  if (self.version > loaded.version
    && loaded.version === "2.3.0"
    && loaded.options.generatedSymbolPrefix === "_early_nodent_") {
      console.log('versionAwareLoader test PASSED') ;
      return true ;
    } else {
      console.log(loaded) ;
      console.log(self) ;
      throw new Error('versionAwareLoader test FAILED') ;
    }

}
