
var peepholes = Object.keys(peepholesCounter)
peepholes.map(function (name) { return { name: name, count: peepholesCounter[name] }; })
var data = peepholes.map(function (name) { return { name: name, count: peepholesCounter[name] }; })
data.sort(function (a, b) { return b.count - a.count; })