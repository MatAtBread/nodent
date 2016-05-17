'use nodent-es7';

module.exports = async function getVersion() {
  return {version:require('nodent')().version, options:__nodent} ;
}
