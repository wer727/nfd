const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/misak10/nfd/main/src/worker.js'
const CACHE_TIME = 60 * 60 * 1000 // 缓存1小时

async function getWorkerCode() {
  const cacheKey = new Request(GITHUB_RAW_URL)
  const cache = caches.default
  
  try {
    // 尝试从缓存获取
    let response = await cache.match(cacheKey)
    
    // 检查缓存是否存在且未过期
    if (response) {
      const cachedTime = parseInt(response.headers.get('x-cached-time') || '0')
      if (Date.now() - cachedTime < CACHE_TIME) {
        console.log('Using cached worker code')
        return await response.text()
      }
    }
    
    // 从 GitHub 获取新代码
    console.log('Fetching fresh worker code')
    response = await fetch(GITHUB_RAW_URL)
    if (!response.ok) {
      throw new Error('Failed to fetch worker code')
    }
    
    const code = await response.text()
    
    // 创建新的响应对象，添加缓存时间
    const newResponse = new Response(code, {
      headers: {
        'content-type': 'application/javascript',
        'x-cached-time': Date.now().toString(),
        'cache-control': 'public, max-age=3600'
      }
    })
    
    // 存入缓存
    await cache.put(cacheKey, newResponse.clone())
    
    return code
  } catch (error) {
    console.error('Error fetching worker code:', error)
    
    // 如果有缓存，在出错时使用缓存的代码（即使已过期）
    if (response) {
      console.log('Using expired cache due to error')
      return await response.text()
    }
    
    throw error
  }
}

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // 添加手动刷新缓存的端点
  if (url.pathname === '/admin/refresh-cache') {
    try {
      const cache = caches.default
      await cache.delete(new Request(GITHUB_RAW_URL))
      await getWorkerCode() // 重新获取并缓存代码
      return new Response('Cache refreshed successfully')
    } catch (error) {
      return new Response('Failed to refresh cache: ' + error.message, { status: 500 })
    }
  }

  try {
    // 获取代码（优先使用缓存）
    const code = await getWorkerCode()
    
    // 添加环境变量
    const workerCode = `
      const ENV_BOT_TOKEN = '${ENV_BOT_TOKEN}'
      const ENV_BOT_SECRET = '${ENV_BOT_SECRET}'
      const ENV_ADMIN_UID = '${ENV_ADMIN_UID}'
      
      ${code}
    `
    
    // 执行代码
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
    const worker = new AsyncFunction('fetch', 'Request', 'Response', workerCode)
    
    return await worker(fetch, Request, Response)
  } catch (error) {
    console.error('Worker loader error:', error)
    return new Response('Worker initialization failed: ' + error.message, { status: 500 })
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
}) 
