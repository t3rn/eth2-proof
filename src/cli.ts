import {
  generateStateProof,
  generateTransactionProof,
  generateTxReceiptProof,
  setupEthRPCClient,
} from './generate-proof'

const args = process.argv.slice(2)

if (args.length) {
  switch (args[0]) {
    case 'state':
      if (args.length !== 4) {
        console.error(
          'Usage: node script.js state <accountId> <storageId> <blockNumber>',
        )
        process.exit(1)
      }
      generateStateProof(args[1], args[2], args[3], setupEthRPCClient())
        .then(console.log)
        .catch(console.error)
      break

    case 'receipt':
      if (args.length !== 2) {
        console.error('Usage: node script.js receipt <txId>')
        process.exit(1)
      }
      generateTxReceiptProof(args[1], setupEthRPCClient())
        .then(console.log)
        .catch(console.error)
      break

    case 'transaction':
      if (args.length !== 2) {
        console.error('Usage: node script.js transaction <txId>')
        process.exit(1)
      }
      generateTransactionProof(args[1], setupEthRPCClient())
        .then(console.log)
        .catch(console.error)
      break

    default:
      console.error(
        'Unknown command. Supported commands are state, receipt, transaction.',
      )
      process.exit(1)
  }
} else {
  console.error(
    'Please specify a command. Supported commands are state, receipt, transaction.',
  )
  process.exit(1)
}
