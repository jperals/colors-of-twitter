function nDecimals(n, decimals = 2) {
  if (typeof n !== 'number') return n
  const factor = Math.pow(10, decimals)
  return Math.round(n * factor) / factor
}

module.exports = {
  nDecimals
}
