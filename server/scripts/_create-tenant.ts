import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const t = await p.tenant.create({
    data: {
      tenantName: '异元科技',
      tenantCode: 'XenosMeta',
      type: 'system',
      adminId: '9d3a62f8-b2f7-455a-8933-95158999b25f',
    },
  })
  console.log(JSON.stringify(t, null, 2))
  await p.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
