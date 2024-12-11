const TOKEN = ENV_BOT_TOKEN // Get it from @BotFather
const WEBHOOK = '/endpoint'
const SECRET = ENV_BOT_SECRET // A-Z, a-z, 0-9, _ and -
const ADMIN_UID = ENV_ADMIN_UID // your user id, get it from https://t.me/username_to_id_bot

const NOTIFY_INTERVAL = 3600 * 1000;
const fraudDb = 'https://raw.githubusercontent.com/misak10/nfd/main/data/fraud.db';
const startMsgUrl = {
  admin: 'https://raw.githubusercontent.com/misak10/nfd/main/data/startMessage.md',
  guest: 'https://raw.githubusercontent.com/misak10/nfd/main/data/startMessage_guest.md'
}

// 定义命令菜单
const commands = {
  admin: [
    {command: 'help', description: '显示管理员帮助'},
    {command: 'block', description: '屏蔽用户 (回复消息或输入用户ID)'},
    {command: 'unblock', description: '解除屏蔽 (回复消息或输入用户ID)'},
    {command: 'checkblock', description: '检查用户状态 (回复消息或输入用户ID)'},
    {command: 'kk', description: '查看用户详细信息 (回复消息或输入用户ID)'},
    {command: 'info', description: '查看自己的信息'}
  ],
  guest: [
    {command: 'start', description: '开始使用机器人'},
    {command: 'info', description: '查看个人信息'}
  ]
}

const enable_notification = true

// 美化消息模板
const templates = {
  help: () => `
📝 <b>管理员命令使用说明</b>
━━━━━━━━━━━━━━━━
1️⃣ 回复用户消息并直接输入文字 - 回复用户
2️⃣ /block [用户ID] - 屏蔽用户
3️⃣ /unblock [用户ID] - 解除屏蔽
4️⃣ /checkblock [用户ID] - 检查用户状态
5️⃣ /kk [用户ID] - 查看用户详细信息
6️⃣ /help - 显示此帮助信息

<i>❗️注意: /block、/unblock、/checkblock、/kk 可以回复消息或直接输入用户ID</i>
`,

  newUser: (user) => `
🎉 <b>新用户开始使用机器人</b>
━━━━━━━━━━━━━━━━
👤 <b>用户信息</b>
┣ 昵称: <b>${user.first_name}${user.last_name ? ' ' + user.last_name : ''}</b>
┣ 用户名: ${user.username ? '@' + user.username : '未设置'}
┣ ID: <code>${user.id}</code>
┗ 语言: ${user.language_code || '未知'}

⏰ 时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}
`,

  userInfo: (user, firstContact = null) => `
👤 <b>用户信息</b>
━━━━━━━━━━━━━━━━
📌 基本信息
┣ 昵称: <b>${user.first_name}${user.last_name ? ' ' + user.last_name : ''}</b>
┣ 用户名: ${user.username ? '@' + user.username : '未设置'}
┣ ID: <code>${user.id}</code>
┗ 语言: ${user.language_code || '未知'}
${firstContact ? `\n📅 首次联系: ${new Date(parseInt(firstContact)).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}` : ''}

⏰ 查询时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}
`,

  fraudDetected: (id) => `
⚠️ <b>检测到可疑用户</b>
━━━━━━━━━━━━━━━━
🚫 用户ID: <code>${id}</code>
⏰ 时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}

<i>❗️建议注意此用户的行为</i>
`,

  blocked: (id) => `
✅ <b>用户已被屏蔽</b>
━━━━━━━━━━━━━━━━
🚫 用户ID: <code>${id}</code>
⏰ 操作时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}
`,

  unblocked: (id) => `
🔓 <b>已解除用户屏蔽</b>
━━━━━━━━━━━━━━━━
👤 用户ID: <code>${id}</code>
⏰ 操作时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}
`,

  blockStatus: (id, blocked) => `
ℹ️ <b>用户状态查询</b>
━━━━━━━━━━━━━━━━
👤 用户ID: <code>${id}</code>
📊 状态: ${blocked ? '🚫 已屏蔽' : '✅ 正常'}
⏰ 查询时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}
`
}

// 统一错误处理
const handleError = (error, chatId) => {
  console.error('Error:', error)
  let errorMsg = '⚠️ 系统错误'
  
  if(error.message.includes('message not found')) {
    errorMsg = '❌ 消息未找到'
  } else if(error.message.includes('bot was blocked')) {
    errorMsg = '❌ 机器人已被用户屏蔽'
  } else if(error.message.includes('chat not found')) {
    errorMsg = '❌ 找不到该聊天'
  } else if(error.message.includes('Too Many Requests')) {
    errorMsg = '⚠️ 请求过于频繁,请稍后再试'
  }

  return sendMessage({
    chat_id: chatId,
    text: errorMsg
  })
}

// 统一管理员通知
const notifyAdmin = async (text) => {
  try {
    await sendMessage({
      chat_id: ADMIN_UID,
      text: text,
      parse_mode: 'HTML'
    })
  } catch (error) {
    console.error('Failed to notify admin:', error)
  }
}

/**
 * Return url to telegram api, optionally with parameters added
 */
function apiUrl (methodName, params = null) {
  let query = ''
  if (params) {
    query = '?' + new URLSearchParams(params).toString()
  }
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`
}

function requestTelegram(methodName, body, params = null){
  return fetch(apiUrl(methodName, params), body)
    .then(r => r.json())
    .catch(error => {
      console.error(`Telegram API Error (${methodName}):`, error)
      throw error
    })
}

function makeReqBody(body){
  return {
    method:'POST',
    headers:{
      'content-type':'application/json'
    },
    body:JSON.stringify(body)
  }
}

function sendMessage(msg = {}){
  return requestTelegram('sendMessage', makeReqBody(msg))
}

function copyMessage(msg = {}){
  return requestTelegram('copyMessage', makeReqBody(msg))
}

function forwardMessage(msg){
  return requestTelegram('forwardMessage', makeReqBody(msg))
}

// 获取用户信息
async function getChat(chatId) {
  return requestTelegram('getChat', makeReqBody({
    chat_id: chatId
  }))
}

// 设置命令菜单
async function setCommands() {
  try {
    // 设置管理员命令
    await requestTelegram('setMyCommands', makeReqBody({
      commands: commands.admin,
      scope: {
        type: 'chat',
        chat_id: ADMIN_UID
      }
    }))
    
    // 设置普通用户命令
    await requestTelegram('setMyCommands', makeReqBody({
      commands: commands.guest,
      scope: {
        type: 'default'
      }
    }))
  } catch (error) {
    console.error('Failed to set commands:', error)
  }
}

/**
 * Wait for requests to the worker
 */
addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (url.pathname === WEBHOOK) {
    event.respondWith(handleWebhook(event))
  } else if (url.pathname === '/registerWebhook') {
    event.respondWith(registerWebhook(event, url, WEBHOOK, SECRET))
  } else if (url.pathname === '/unRegisterWebhook') {
    event.respondWith(unRegisterWebhook(event))
  } else {
    event.respondWith(new Response('No handler for this request'))
  }
})

/**
 * Handle requests to WEBHOOK
 */
async function handleWebhook (event) {
  try {
    if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
      return new Response('Unauthorized', { status: 403 })
    }

    const update = await event.request.json()
    event.waitUntil(onUpdate(update))

    return new Response('Ok')
  } catch (error) {
    console.error('Webhook Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * Handle incoming Update
 */
async function onUpdate (update) {
  try {
    if ('message' in update) {
      await onMessage(update.message)
    }
  } catch (error) {
    console.error('Update handling error:', error)
  }
}

/**
 * Handle incoming Message
 */
async function onMessage (message) {
  try {
    if(message.text === '/start'){
      let startMsg
      if(message.chat.id.toString() === ADMIN_UID) {
        startMsg = await fetch(startMsgUrl.admin).then(r => r.text())
        // 设置命令菜单
        await setCommands()
      } else {
        startMsg = await fetch(startMsgUrl.guest).then(r => r.text())
      }
      
      // 记录用户首次联系时间
      let firstContact = await nfd.get('first-contact-' + message.chat.id)
      if(!firstContact) {
        await nfd.put('first-contact-' + message.chat.id, Date.now().toString())
      }
      
      return sendMessage({
        chat_id: message.chat.id,
        text: startMsg,
        parse_mode: 'Markdown'
      })
    }

    if(message.text === '/info'){
      return sendMessage({
        chat_id: message.chat.id,
        text: templates.userInfo(message.from),
        parse_mode: 'HTML'
      })
    }

    if(message.chat.id.toString() === ADMIN_UID){
      return handleAdminMessage(message)
    }

    return handleGuestMessage(message)
  } catch (error) {
    return handleError(error, message.chat.id)
  }
}

async function handleAdminMessage(message) {
  // 处理 /help 命令
  if(message.text === '/help') {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: templates.help(),
      parse_mode: 'HTML'
    })
  }

  // 处理带参数的命令
  const [command, userId] = message.text.split(' ')
  const commandHandlers = {
    '/block': handleBlock,
    '/unblock': handleUnBlock,
    '/checkblock': checkBlock,
    '/kk': handleKK
  }

  const handler = commandHandlers[command]
  if(handler) {
    if(userId) {
      // 使用用户ID直接操作
      return handler(message, userId)
    } else if(message?.reply_to_message?.chat) {
      // 通过回复消息操作
      return handler(message)
    } else {
      return sendMessage({
        chat_id: ADMIN_UID,
        text: '❌ 请提供用户ID或回复用户消息',
        parse_mode: 'HTML'
      })
    }
  }

  // 处理普通回复消息
  if(message?.reply_to_message?.chat) {
    let guestChantId = await nfd.get('msg-map-' + message?.reply_to_message.message_id, { type: "json" })
    return copyMessage({
      chat_id: guestChantId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    })
  }

  return sendMessage({
    chat_id: ADMIN_UID,
    text: templates.help(),
    parse_mode: 'HTML'
  })
}

async function handleGuestMessage(message){
  let chatId = message.chat.id;
  let isblocked = await nfd.get('isblocked-' + chatId, { type: "json" })
  
  if(isblocked){
    return sendMessage({
      chat_id: chatId,
      text: '🚫 您已被封禁访问'
    })
  }

  let forwardReq = await forwardMessage({
    chat_id: ADMIN_UID,
    from_chat_id: message.chat.id,
    message_id: message.message_id
  })

  if(forwardReq.ok){
    await nfd.put('msg-map-' + forwardReq.result.message_id, chatId)
    // 在用户发送消息时通知管理员用户详细信息
    await notifyAdmin(templates.newUser(message.from))
  }
  
  return handleNotify(message)
}

async function handleNotify(message){
  let chatId = message.chat.id;
  
  if(await isFraud(chatId)){
    return notifyAdmin(templates.fraudDetected(chatId))
  }
  
  if(enable_notification){
    let lastMsgTime = await nfd.get('lastmsg-' + chatId, { type: "json" })
    if(!lastMsgTime || Date.now() - lastMsgTime > NOTIFY_INTERVAL){
      await nfd.put('lastmsg-' + chatId, Date.now())
    }
  }
}

async function handleBlock(message, userId = null){
  let guestChantId
  if(userId) {
    guestChantId = userId
  } else {
    guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" })
  }
  
  if(guestChantId === ADMIN_UID){
    return sendMessage({
      chat_id: ADMIN_UID,
      text: '❌ 不能屏蔽自己',
      parse_mode: 'HTML'
    })
  }
  
  await nfd.put('isblocked-' + guestChantId, true)
  return notifyAdmin(templates.blocked(guestChantId))
}

async function handleUnBlock(message, userId = null){
  let guestChantId
  if(userId) {
    guestChantId = userId
  } else {
    guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" })
  }
  
  await nfd.put('isblocked-' + guestChantId, false)
  return notifyAdmin(templates.unblocked(guestChantId))
}

async function checkBlock(message, userId = null){
  let guestChantId
  if(userId) {
    guestChantId = userId
  } else {
    guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" })
  }
  
  let blocked = await nfd.get('isblocked-' + guestChantId, { type: "json" })
  return notifyAdmin(templates.blockStatus(guestChantId, blocked))
}

async function handleKK(message, userId = null) {
  let guestChantId
  if(userId) {
    guestChantId = userId
  } else {
    guestChantId = await nfd.get('msg-map-' + message.reply_to_message.message_id, { type: "json" })
  }

  let userInfo = await getChat(guestChantId)
  
  if(userInfo.ok) {
    let user = userInfo.result
    // 获取用户的首次联系时间
    let firstContact = await nfd.get('first-contact-' + guestChantId)
    return sendMessage({
      chat_id: ADMIN_UID,
      text: templates.userInfo(user, firstContact),
      parse_mode: 'HTML'
    })
  } else {
    return sendMessage({
      chat_id: ADMIN_UID,
      text: '❌ 无法获取用户信息',
      parse_mode: 'HTML'
    })
  }
}

/**
 * Send plain text message
 */
async function sendPlainText (chatId, text) {
  return sendMessage({
    chat_id: chatId,
    text,
    parse_mode: 'Markdown'
  })
}

/**
 * Set webhook to this worker's url
 */
async function registerWebhook (event, requestUrl, suffix, secret) {
  try {
    const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`
    const r = await fetch(apiUrl('setWebhook', { 
      url: webhookUrl, 
      secret_token: secret,
      max_connections: 100
    })).then(r => r.json())
    return new Response('ok' in r && r.ok ? '✅ Webhook设置成功' : JSON.stringify(r, null, 2))
  } catch (error) {
    return new Response('❌ Webhook设置失败: ' + error.message)
  }
}

/**
 * Remove webhook
 */
async function unRegisterWebhook (event) {
  try {
    const r = await fetch(apiUrl('setWebhook', { url: '' })).then(r => r.json())
    return new Response('ok' in r && r.ok ? '✅ Webhook已移除' : JSON.stringify(r, null, 2))
  } catch (error) {
    return new Response('❌ Webhook移除失败: ' + error.message)
  }
}

async function isFraud(id){
  try {
    id = id.toString()
    let db = await fetch(fraudDb).then(r => r.text())
    let arr = db.split('\n').filter(v => v)
    return arr.includes(id)
  } catch (error) {
    console.error('Fraud check error:', error)
    return false
  }
}
