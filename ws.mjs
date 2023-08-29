/* gestion WebSocket */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const WebSocket = require('websocket').w3cwebsocket

import { decode } from '@msgpack/msgpack'
import { urlwss, Session, AppExc, E_WS, PINGTO } from './asocial.mjs'

function dhtToString (dht) {
  return new Date(Math.floor(dht / 1000)).toISOString() + ' (' + (dht % 1000) + ')'
}

let pongrecu, debug, heartBeatTo, ws, exc, job = false

function reset () {
  pongrecu = false
  debug = true
  heartBeatTo = null
  ws = null
  exc = null
}

// // 'Erreur à l\'ouverture de la connexion avec le serveur ( {0} ).\nDétail: {1}',
function EX0 (e) { return new AppExc(E_WS, 0, [url, e.message]) }

// 'Ouverture de la connexion avec le serveur impossible ( {0} ).',
function EX1 () { return new AppExc(E_WS, 1, [url]) }

// 'Envoi d\'un message au serveur impossible ( {0} ).\nDétail: {1}',
function EX2 (e) { return new AppExc(E_WS, 2, [url, e.message]) }

// 'Rupture de la liaison avec le serveur par le serveur ou URL mal configurée ( {0} ).',
function EX3 () { return new AppExc(E_WS, 3, [url])}

// 'ping / pong : pong non reçu ( {0} ).',
function EX4 () { return new AppExc(E_WS, 4, [url]) }

export function closeWS () {
  if (heartBeatTo) { clearTimeout(heartBeatTo); heartBeatTo = null }
  if (ws) { try { ws.close(); } catch (e) { } }
}

function setExc (e) {
  console.log('Exception ws : ' + e.code + ' wss: ' + urlwss)
  if (heartBeatTo) { clearTimeout(heartBeatTo); heartBeatTo = null }
  if (ws) { try { ws.close(); } catch (e) { } }
}

export async function openWS () {
  reset()
  const session = Session.session
  const sessionId = session.sessionId
  return new Promise((resolve, reject) => {
    try {
      exc = null
      if (debug) console.log(urlwss)
      if (heartBeatTo) { clearTimeout(heartBeatTo); heartBeatTo = null }
      ws = new WebSocket(urlwss)
      ws.onerror = (e) => {
        setExc(EX1())
        reject()
      }
      ws.onclose = () => {
        if (session.sessionId === sessionId) {
          /* fermeture du webSocket par le serveur ou par défaut de pong (exc non null)
          alors que la session est encore vivante */
          if (heartBeatTo) { clearTimeout(heartBeatTo); heartBeatTo = null }
        }
      }
      ws.onmessage = onmessage
      ws.onopen = (event) => {
        try {
          job = false
          ws.send(session.sessionId)
          heartBeat(session.sessionId)
          resolve()
        } catch (e) {
          reject(EX2(e))
        }
      }
    } catch (e) {
      // Sur erreur d'URL (mauvais schéma)
      const ex = EX0(e)
      setExc(ex)
      reject(ex)
    }
  })
}

async function onmessage (m) {
  const session = Session.session

  const sessionId = session.sessionId
  const ab = await m.data //.arrayBuffer()
  const msg = new Uint8Array(ab)
  const syncList = decode(msg) // syncList : { sessionId, rows[] }
  if (syncList.sessionId !== sessionId) return

  const pong = !syncList.rows
  if (debug) console.log('Liste sync reçue - sessionId:' + syncList.sessionId + 
    (!pong ? ' nb rows:' + syncList.rows.length : ' - pong: ' + dhtToString(syncList.dh)))

  if (pong) {
    pongrecu = true
  } else {
    syncList.rows.forEach(row => { Session.onrow(row) })
  }
}

function heartBeat (sid) {
  const session = Session.session
  heartBeatTo = setTimeout(async () => {
    if (ws && session.sessionId === sid) {
      if (!pongrecu) {
        exc = EX4()
        ws.close()
        return
      }
      pongrecu = false
      ws.send(sid) // ping
      heartBeat(sid)
    }
  }, PINGTO * 1000 * (debug ? 1000 : 1))
}
