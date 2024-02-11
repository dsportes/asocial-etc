import schedule from 'node-schedule'

setTimeout(() => {
  const job = schedule.scheduleJob('0 0 16 ? * * *', function(fireDate){
    console.log('This job was supposed to run at ' + fireDate + ', but actually ran at ' + new Date());
  })
}, 50)
