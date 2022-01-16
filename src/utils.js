export const absoluteUrl = url => {
  if (/^https?/.test(url)) return url
  let baseUrl = window.location.protocol + '//' + window.location.host

  if (url[0] === '/') {
    return baseUrl + url
  }

  return baseUrl + window.location.pathname + '/' + url
}

export const parseHeaders = headers =>
  [...headers.entries()].reduce((acc, [key, value]) => {
    acc[key] = value
    return acc
  }, {})

export const parseUrl = url => new URL(url)

export const transform = (transformers, value, ctx = null) =>
  transformers.reduce((x, f) => f.call(ctx, x), value)
