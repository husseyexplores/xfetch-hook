import { parseUrl, parseHeaders, transform } from './utils.js'

export default function startProxingFetch({
  namespace = globalThis || window,
  fetch: originalFetch = namespace.fetch,
} = {}) {
  if (namespace == null) namespace = globalThis || window
  if (typeof namespace != 'object') {
    throw new Error('[xfetch-hook] - `namespace` should be an object')
  }

  if (typeof originalFetch !== 'function') {
    throw new Error('[xfetch-hook] - `fetch` should be a function')
  }

  // Already listening?
  if (typeof originalFetch.onRequest === 'function') {
    return originalFetch.stopIntercepting
  }

  const FETCH_NAME = 'fetch'

  // -------------

  let middlewares = []

  async function proxiedFetch(...args) {
    const listeners = []
    const transformers = []

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

        if (typeof intercept.transformResponse === 'function') {
          transformers.push(intercept.transformResponse)
        }
      }
    }

    /**
     *
     * @param {Response} res
     * @returns Response
     */
    async function handleResponse(res) {
      let transformedResponse = res

      let canParseResponse = parseAs && typeof res[parseAs] === 'function'
      let responseData = await (canParseResponse && res.clone()[parseAs]())

      if (transformers.length > 0) {
        let transformedResponseData = transform(transformers, responseData)
        if (typeof transformedResponseData !== 'string') {
          transformedResponseData = JSON.stringify(transformedResponseData)
        }

        transformedResponse = new Response(transformedResponseData, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        })
      }

      listeners.forEach(fn => {
        const cloned = transformedResponse.clone()
        canParseResponse
          ? cloned[parseAs]().then(fn.bind(null, cloned))
          : fn(cloned)
      })
      return transformedResponse
    }

    if (response) {
      return handleResponse(response)
    }

    return originalFetch(request).then(handleResponse)
  }

  // Make the proxiedFetch function name same as the original function name
  // So that `fetch.name` returns `fetch` instead of `proxiedFetch`
  Object.defineProperty(proxiedFetch, 'name', {
    value: FETCH_NAME,
    configurable: true,
  })

  function startProxying() {
    namespace[FETCH_NAME] = proxiedFetch
  }
  startProxying()

  function stopProxying() {
    namespace[FETCH_NAME] = originalFetch
  }

  function unsubscribeMiddleware(middlewareFn) {
    middlewares = middlewares.filter(x => x !== middlewareFn)
  }
  function subscribeMiddleware(middlewareFn) {
    middlewares.push(middlewareFn)
  }

  proxiedFetch.stopProxying = stopProxying
  proxiedFetch.onRequest = function onRequest(middlewareFn) {
    if (typeof middlewareFn !== 'function') {
      throw new Error(
        '[xfetch-hook] - `onRequest`: argument must be a function'
      )
    }

    const unsubscribe = () => unsubscribeMiddleware(middlewareFn)

    const alreadyRegistered = middlewares.find(x => x === middlewareFn)
    if (!alreadyRegistered) subscribeMiddleware(middlewareFn)

    return unsubscribe
  }

  return stopProxying
}
