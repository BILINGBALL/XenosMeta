import express from 'express'
import userRoutes from './user.routes'
import tenantRoutes from './tenant.routes'
import systemRoute from "./system.routes"
import groupRoutes from "./group.routes"
import dynamicRoutes from "./dynamic.routes"
import mirrorRoutes from "./mirror.routes"
import roleRoutes from "./role.routes"
import permissionRoutes from "./permission.routes"
import developerRoutes from "./developer.routes"
import fileRoutes from "@modules/file/file.routes"
import agentRoutes from "@modules/agent/agent.routes"

const router = express.Router()

router.use('/tenant', tenantRoutes)
router.use('/user', userRoutes)
router.use('/system', systemRoute)
router.use('/group', groupRoutes)
router.use("/dynamic", dynamicRoutes)
router.use("/dynamic", mirrorRoutes)
router.use('/role', roleRoutes)
router.use('/permission', permissionRoutes)
router.use('/developer', developerRoutes)
router.use('/file', fileRoutes)
router.use('/agent', agentRoutes)

export default router