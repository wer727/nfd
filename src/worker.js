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

  // 处理 Telegram Webhook 请求
  if (url.pathname === '/endpoint') {
    try {
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== ENV_BOT_SECRET) {
        return new Response('Unauthorized', { status: 403 })
      }

      const update = await request.json()
      
      // 获取 worker 代码
      const code = await getWorkerCode()
      const worker = require(code)
      
      // 处理更新
      await worker.handleUpdate(update)
      
      return new Response('Ok')
    } catch (error) {
      console.error('Webhook Error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
  
  // 处理 Webhook 注册
  if (url.pathname === '/registerWebhook') {
    try {
      const webhookUrl = `${url.protocol}//${url.hostname}/endpoint`
      const response = await fetch(`https://api.telegram.org/bot${ENV_BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: ENV_BOT_SECRET,
          max_connections: 100
        })
      })
      
      const result = await response.json()
      return new Response(result.ok ? '✅ Webhook设置成功' : JSON.stringify(result, null, 2))
    } catch (error) {
      return new Response('❌ Webhook设置失败: ' + error.message)
    }
  }
  
  // 处理 Webhook 注销
  if (url.pathname === '/unRegisterWebhook') {
    try {
      const response = await fetch(`https://api.telegram.org/bot${ENV_BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: '' })
      })
      
      const result = await response.json()
      return new Response(result.ok ? '✅ Webhook已移除' : JSON.stringify(result, null, 2))
    } catch (error) {
      return new Response('❌ Webhook移除失败: ' + error.message)
    }
  }

  return new Response('No handler for this request')
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
}) 
