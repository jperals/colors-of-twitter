function nDecimals(n, decimals = 2) {
  if (typeof n !== 'number' || n === Infinity) return n
  const factor = Math.pow(10, decimals)
  return Math.round(n * factor) / factor
}

module.exports = {
  nDecimals
}
