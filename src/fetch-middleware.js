import { parseUrl, parseHeaders } from './utils.js'

export default function startInterceptingFetch({
  namespace = globalThis || window,
  fetch: originalFetch = namespace.fetch,
} = {}) {
  if (namespace == null) namespace = globalThis || window
  if (typeof namespace != 'object') {
    throw new Error('[xfetch-middleware] - `namespace` should be an object')
  }

  if (typeof originalFetch !== 'function') {
    throw new Error('[xfetch-middleware] - `fetch` should be a function')
  }

  // Already listening?
  if (typeof originalFetch.onRequest === 'function') {
    return originalFetch.stopIntercepting
  }

  const FETCH_NAME = 'fetch'

  // -------------

  const middlewares = []

  async function interceptedFetch(...args) {
    const listeners = []
    let request = new Request(...args)
    let response = null
    let parseAs = null

    let _parsedUrl = null
    let _parsedHeaders = null

    for (const middleware of middlewares) {
      let intercept = await middleware({
        request,
        fetch: originalFetch,
        get url() {
          return _parsedUrl || (_parsedUrl = parseUrl(request.url))
        },
        get headers() {
          return (
            _parsedHeaders || (_parsedHeaders = parseHeaders(request.headers))
          )
        },
      })

      if (!intercept) continue

      if (intercept.request instanceof Request) {
        request = intercept.request
      }

      if (intercept.response instanceof Response) {
        response = intercept.response
      }

      if (typeof intercept.listen === 'function') {
        listeners.push(intercept.listen)
      }

      if (typeof intercept.as === 'string') {
        parseAs = intercept.as
      }
    }

    async function handleResponse(res) {
      let parseResponse = parseAs && typeof res[parseAs] === 'function'
      listeners.forEach(fn => {
        const cloned = res.clone()
        parseResponse ? cloned[parseAs]().then(fn) : fn(cloned)
      })
      return res
    }

    if (response) {
      return handleResponse(response)
    }

    return originalFetch(request).then(handleResponse)
  }

  // Make the interceptedFetch function name same as the original function name
  // So that `fetch.name` returns `fetch` instead of `interceptedFetch`
  Object.defineProperty(interceptedFetch, 'name', {
    value: FETCH_NAME,
    configurable: true,
  })

  function startIntercepting() {
    namespace[FETCH_NAME] = interceptedFetch
  }
  startIntercepting()

  function stopIntercepting() {
    namespace[FETCH_NAME] = originalFetch
  }

  function unsubscribeMiddleware(middlewareFn) {
    middlewares.filter(x => x !== middlewareFn)
  }
  function subscribeMiddleware(middlewareFn) {
    middlewares.push(middlewareFn)
  }

  interceptedFetch.stopIntercepting = stopIntercepting
  interceptedFetch.onRequest = function onRequest(middlewareFn) {
    if (typeof middlewareFn !== 'function')
      throw new Error('[onRequest] - Argument must be a function')

    const unsubscribe = () => unsubscribeMiddleware(middlewareFn)

    const alreadyRegistered = middlewares.find(x => x === middlewareFn)
    if (!alreadyRegistered) subscribeMiddleware(middlewareFn)

    return unsubscribe
  }

  return stopIntercepting
}
