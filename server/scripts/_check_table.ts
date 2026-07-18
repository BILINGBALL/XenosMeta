import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const result = await p.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)
  console.log(result)
  await p.$disconnect()
}
main()
