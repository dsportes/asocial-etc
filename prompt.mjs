/*
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});
*/

/*
readline.question('Who are you?', name => {
  console.log(`Hey there ${name}!`);
  readline.close();
});
*/
import { createInterface } from 'readline'
import { stdin, stdout } from 'process'

/*
function prompt (q) {
  return new Promise((resolve, reject) => {
    const opt = { input: stdin, output: stdout }
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    })

    readline.question(q, rep => {
      readline.close()
      resolve(rep)
      // readline.close()
    })    
  })
}
*/

function prompt (q) {
  return new Promise((resolve, reject) => {
    const opt = { input: stdin, output: stdout }
    const readline = createInterface(opt)

    readline.question(q, rep => {
      readline.close()
      resolve(rep)
      // readline.close()
    })    
  })
}

async function main () {
  try {
    let r = await prompt('Qui est-ce ?\n')
    console.log('Lu:>>>' + r + '<<<')
    r = await prompt('Vraiment ?\n')
    console.log('Lu:>>>' + r + '<<<')
    console.log('***')
  } catch (e) {
      console.log(e)
  }
}

main()
