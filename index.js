async function startnigg(phone) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(sessionFolder)) {
        await fs.mkdirSync(sessionFolder)
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionFolder)

      const xlicon = Baileys.makeWASocket({
        version: [2, 3000, 1015901307],
        printQRInTerminal: false,
        logger: pino({
          level: 'silent',
        }),
        browser: Browsers.ubuntu("Chrome"),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino().child({
              level: 'fatal',
              stream: 'store',
            })
          ),
        },
      })

      if (!xlicon.authState.creds.registered) {
        let phoneNumber = phone ? phone.replace(/[^0-9]/g, '') : ''
        if (phoneNumber.length < 11) {
          return reject(new Error('Please Enter Your Number With Country Code !!'))
        }
        setTimeout(async () => {
          try {
            let code = await xlicon.requestPairingCode(phoneNumber)
            console.log(`Your Pairing Code : ${code}`)
            resolve(code)
          } catch (requestPairingCodeError) {
            const errorMessage = 'Error requesting pairing code from WhatsApp'
            console.error(errorMessage, requestPairingCodeError)
            return reject(new Error(errorMessage))
          }
        }, 3000)
      }

      xlicon.ev.on('creds.update', saveCreds)

      xlicon.ev.on('connection.update', async update => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
          await delay(10000)

          // Upload session to Mega
          const credsPath = `${sessionFolder}/creds.json`
          const output = await upload(fs.createReadStream(credsPath), `${xlicon.user.id}.json`)
          const string_session = output.replace('https://mega.nz/file/', '')
          const md = `SREEJAN-MD=${string_session}`

          // Send session string to user
          const message = await xlicon.sendMessage(xlicon.user.id, { text: md })

          // Send additional description
          const description = `
*Hello there SREEJAN-MD User! 👋*

> *Do not share your session id with anyone.*
> *Thanks for using SREEJAN-MD 🔥*
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
*GitHub:* [Click Here](https://github.com/)
*Channel:* [Join Here](https://whatsapp.com/channel/0029VatOy2EAzNc2WcShQw1j)
          `
          await xlicon.sendMessage(
            xlicon.user.id,
            {
              text: description,
              contextInfo: {
                externalAdReply: {
                  title: "SREEJAN-MD Session",
                  thumbnailUrl: "https://cdn.ironman.my.id/i/p24kp2.jpg",
                  sourceUrl: "https://github.com/",
                  renderLargerThumbnail: true,
                },
              },
            },
            { quoted: message }
          )

          console.log('Connected to WhatsApp Servers')

          // Clean up
          deleteSessionFolder()
          process.send('reset')
        }

        if (connection === 'close') {
          // Handle connection close logic here...
        }
      })

      xlicon.ev.on('messages.upsert', () => {})
    } catch (error) {
      console.error('An Error Occurred:', error)
      throw new Error('An Error Occurred')
    }
  })
}
