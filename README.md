# Fetch/XHR Middleware

**Alpha release - API may change**

Extremly simple way to:
- Intercept a fetch/XHR request
- Listen on a fetch/XHR request

## Usage:
You can use this with or without ESM. Can use `fetch` or `XMLHttpRequest` or both at the same time.
Check all the available [CDN exports](https://unpkg.com/browse/xfetch-hook/dist/):

**ESM**
```html
<script type="module">
  // Import both, fetch and xhr
  import * as xfetch from 'https://unpkg.com/browse/xfetch-hook@latest/dist/fetch-xhr.module.min.js'

  const { fetchHook, xhrHook } = xfetch

  // Or only import what's needed
  import fetchHook from 'https://unpkg.com/browse/xfetch-hook@latest/dist/fetch.module.min.js'
  import xhrHook from 'https://unpkg.com/browse/xfetch-hook@latest/dist/xhr.module.min.js'

  // Initialize once
  fetchHook()
  xhrHook()

  // Start using by registering your middleware functions!
  fetch.onRequest(fetchMiddleware1)
  fetch.onRequest(fetchMiddleware2)
  XMLHttpRequest.onRequest(xhrMiddleware1)
  XMLHttpRequest.onRequest(xhrMiddleware2)
  // ... register any number of hooks
</script>
```

**NON-ESM**
```html
<!-- Load the script -->
<script src="https://unpkg.com/browse/xfetch-hook@latest/dist/fetch-xhr.module.min.js">
</script>

<!-- `xfetch` is now accessible -->
<script>
  // Initialize once
  xfetch.fetchHook()
  xfetch.xhrHook()

  // Start using by registering your middleware functions!
  fetch.onRequest(middleware1)
  ...
</script>
```

**Fetch Middleware**
Once the hook is initialized, `onRequest` function will be exposed on the interface.
It expects a middleware function which is called before any fetch request is called.

```js
async function middleware({ request, url, headers }) {
  // Return null/falsy if this request does not need to be hooked
  return null


  return {
    // Optional - if specified, original request will be overriden - Must be an instance of `Request` class
    request?: new Request(),

    // Optional - if specified, actual network call will not be made (bypass mechanism) - Must be an instance of `Response` class
    response?: new Response(),

    // Optional - if specified, `listen` function will receive `parsedData` as second argument
    // Required - if `transformResponse`, is specified
    as?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'

    // Optional - Provide a listener function. It will be called with `response`, once the request is complete
    // `parsedData` will be available if `as` is specified.
    listen?: (response, parsedData?) => {},

    // Once the network call is made, the parsed response data will be transformed using this transformer function
    // and then passed to the original caller. Think of it as a hook to transform any data before it reaches to the caller.
    // `listen` function will always receive the transformed response and transformed data
    transformResponse?: (parsedData) => {
      return modifyData(parsedData)
    }
  }
}
```

**XMLHttpRequest Middleware**

```js
async function middleware({ method, url, body, headers }) {

  // Overrite any of the paramer
  return {
    // Optional - override the method of xhr. (GET, POST, PUT, etc)
    method?: 'String',

    // Optional - override the xhr URL. Can be string or instance of `new URL()` class
    url?: 'String' | new URL()

    // Optional - update the body of the request
    body,

    // Optional - update the headers of the request - Must be an instance of `new Headers()` class
    headers,

    // Optional - Provide a listener function. It will be called with `response` and `xhr`, once the request is complete
    // Note: `data` refers to `xhr.response`, (not to be confused with `new Response()` constructor)
    listen?: (data, xhr) => {

    },

    // Once the network call is made, the response data will be transformed using this transformer function,
    // and then passed to the original caller. Think of it as a hook to transform any data before it reaches to the caller.
    // `listen` function will always receive the transformed data
    transformResponse?: (data) => {
      return modifyData(data)
    }
  }
}
```

Hooks/middlewares are called in the order they're registered. If any middleware modifies the data
(`request`, `response`, `as`, `method`, `url`, `body`, `transformResponse`), the next middleware will receive the modified data

**Working example**
Shopify has `/cart.js`/`cart.json` endpoints which returns current cart content in JSON
In this example, we modify the response that we get back from Shopify

```html
<script type="module">
  import fetchHook from 'https://unpkg.com/browse/xfetch-hook@latest/dist/fetch.module.min.js'

  fetchHook()


  // Hook for GET: '/cart.json'
  const unsubscribe1 = fetch.onRequest(async ({ url, request }) => {
    const isCartRequest = /\/cart.js(on)?/.test(url.pathname)

    if (!isCartRequest) return

    // we need to listen on only GET requests
    if (request.method  !== 'GET') return

    return {
      // `cart` has `items` array. We will filter out all the items that have 'HIDDEN' product_type
      // original caller will receive the modified data
      transformResponse: cartJson => {
        cartJson.items = cartJson.items.filter(item => item.product_type === 'HIDDEN')
        return cartJson
      },
    }
  })

  // Hook for /cart/change.js and /cart/update.js
  const unsubscribe2 = fetch.onRequest(async ({ url, request }) => {
    const isCartChangeOrUpdateRequest = /\/cart\/(change|update).js(on)?/.test(url.pathname)

    if (!isCartChangeOrUpdateRequest) return

    return {
      // `cart` has `items` array. We will filter out all the items that have 'HIDDEN' product_type
      // original caller will receive the modified data
      transformResponse: cartJson => {
        cartJson.items = cartJson.items.filter(item => item.product_type === 'HIDDEN')
        return cartJson
      },

      // Cart is updated,
      as: 'json',
      listen: (response, cartJson) => {
        // `cartJson` is the trasnfromed cart object
        console.log('Cart has been updated.', cartJson)
      }
    }
  })

  // `unsubscribe` is a function that can be called later to stop this hook
</script>
```