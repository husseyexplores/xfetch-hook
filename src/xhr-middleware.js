import { absoluteUrl, parseHeaders, transform } from './utils.js'

export default function startInterceptingXhr({
  namespace = globalThis || window,
} = {}) {
  if (namespace == null) namespace = globalThis || window
  if (typeof namespace != 'object') {
    throw new Error('[xfetch-middleware] - `namespace` should be an object')
  }

  // create XMLHttpRequest proxy object
  const OriginalXMLHttpRequest = namespace.XMLHttpRequest

  if (typeof OriginalXMLHttpRequest !== 'function') {
    throw new Error(
      '[xfetch-middleware] - `XMLHttpRequest` should be a function.'
    )
  }

  const middlewares = []

  // Proxy
  function ProxiedXMLHttpRequest() {
    let actual = new OriginalXMLHttpRequest()
    let self = this

    let method, url, async, user, pw, body, _parsedHeaders, _transformedResponse
    let transformers = []
    let listeners = []
    this.onreadystatechange = null

    actual.onreadystatechange = function () {
      if (async && this.readyState == 4) {
        let resType = actual.responseType
        try {
          self.response =
            _transformedResponse ||
            (_transformedResponse = transform(transformers, actual.response))

          if (resType === '' || resType === 'text') {
            self.responseText = actual.responseText
          }

          listeners.forEach(f => f.call(self, self))
        } catch (e) {
          console.warn('Error in proxied XMLHTTP', e.message)
        }
      }

      if (self.onreadystatechange) {
        return self.onreadystatechange()
      }
    }

    // add all proxy getters
    ;['status', 'statusText', 'readyState', 'responseXML', 'upload'].forEach(
      function (key) {
        Object.defineProperty(self, key, {
          get: function () {
            return actual[key]
          },
        })
      }
    )

    // add all proxy getters/setters
    ;[
      'ontimeout, timeout',
      'withCredentials',
      'onload',
      'onerror',
      'onprogress',
      'responseType',
    ].forEach(function (key) {
      Object.defineProperty(self, key, {
        get: function () {
          return actual[key]
        },
        set: function (val) {
          if (key === 'onload' && typeof val === 'function') {
            val = val.bind(self)
          }

          actual[key] = val
        },
      })
    })

    // add all pure proxy pass-through methods
    ;[
      'addEventListener',
      'abort',
      'getAllkeyResponseHeaders',
      'getResponseHeader',
      'overrideMimeType',
    ].forEach(function (key) {
      Object.defineProperty(self, key, {
        value: function () {
          return actual[key].apply(actual, arguments)
        },
      })
    })

    let headers = new Headers()
    self.setRequestHeader = function setRequestHeader(key, value) {
      headers.append(key, value)
    }

    self.open = function open(_method, _url, _async, _user, _pw) {
      method = _method
      url = new URL(absoluteUrl(_url))
      async = _async !== false
      user = _user
      pw = _pw
      actual.open(method, url, async, user, pw)
    }

    self.send = async function send(_body) {
      body = _body
      if (async) {
        for (const middleware of middlewares) {
          let icepted = await middleware({
            method,
            url,
            body,
            get headers() {
              return _parsedHeaders || (_parsedHeaders = parseHeaders(headers))
            },
          })

          if (!icepted) continue

          if (icepted.method) method = icepted.method
          if (icepted.url) url = icepted.url.href || icepted.url
          if (icepted.body !== undefined) body = icepted.body
          if (icepted.headers instanceof Headers) headers = icepted.headers
          if (typeof icepted.transformResponse === 'function') {
            transformers.push(icepted.transformResponse)
          }

          if (typeof icepted.listen === 'function') {
            listeners.push(icepted.listen)
          }
        }

        // Initiate actual request
        actual.open(method, url, async, user, pw)
        for (const tuple in headers.entries()) {
          actual.setRequestHeader(tuple[0], tuple[1])
        }
        actual.send(body)
      }
    }
  }

  // Make the interceptedFetch function name same as the original function name
  // So that `fetch.name` returns `fetch` instead of `interceptedFetch`
  Object.defineProperty(ProxiedXMLHttpRequest, 'name', {
    value: 'XMLHttpRequest',
    configurable: true,
  })

  function startIntercepting() {
    namespace['XMLHttpRequest'] = ProxiedXMLHttpRequest
  }
  startIntercepting()

  function stopIntercepting() {
    namespace['XMLHttpRequest'] = OriginalXMLHttpRequest
  }

  function unsubscribeMiddleware(middlewareFn) {
    middlewares.filter(x => x !== middlewareFn)
  }
  function subscribeMiddleware(middlewareFn) {
    middlewares.push(middlewareFn)
  }

  ProxiedXMLHttpRequest.stopIntercepting = stopIntercepting
  ProxiedXMLHttpRequest.onRequest = function onRequest(middlewareFn) {
    if (typeof middlewareFn !== 'function')
      throw new Error('[onRequest] - Argument must be a function')

    const unsubscribe = () => unsubscribeMiddleware(middlewareFn)

    const alreadyRegistered = middlewares.find(x => x === middlewareFn)
    if (!alreadyRegistered) subscribeMiddleware(middlewareFn)

    return unsubscribe
  }

  return stopIntercepting
}
