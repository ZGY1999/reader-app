const importModule = new Function('specifier', 'return import(specifier);');

function dynamicImport(specifier) {
  return importModule(specifier);
}

module.exports = dynamicImport;
module.exports.default = dynamicImport;
