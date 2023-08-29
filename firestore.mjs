// firebase emulators:start --project asocial-test1
import { env } from 'process'
import { Firestore } from '@google-cloud/firestore'
// const Firestore = require('@google-cloud/firestore').Firestore
import { Storage } from '@google-cloud/storage'
// const Storage = require('@google-cloud/storage').Storage
import { LoggingWinston } from '@google-cloud/logging-winston'
// const {LoggingWinston} = require('@google-cloud/logging-winston')
import winston from 'winston'

// process.
env['GOOGLE_CLOUD_PROJECT'] = 'asocial-test1'
// process.
env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080'
// process.
env['STORAGE_EMULATOR_HOST'] = 'http://127.0.0.1:9199'
// process.
env['GOOGLE_APPLICATION_CREDENTIALS'] = './config/service_account.json'

async function main () {
  try {
    const loggingWinston = new LoggingWinston()
    const logger = winston.createLogger({
      level: 'info',
      transports: [
        new winston.transports.Console(),
        // Add Cloud Logging
        loggingWinston,
      ],
    })

    logger.info('Hello world!')
  
    const bucket = new Storage().bucket('asocial-test1.appspot.com')
    const fileName = 'ping.txt'
    await bucket.file(fileName).save(Buffer.from(new Date().toISOString()))

    const fs = new Firestore()
    const dr = fs.doc('singletons/ping')
    await dr.set({ dh: new Date().toISOString() })
  } catch (e) {
      console.log(e)
  }
}

main()