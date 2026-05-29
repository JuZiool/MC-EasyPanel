import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import operationRouter from './fileOperations.js'
import workerRouter from './fileWorkers.js'
import chunkUploadRouter from './fileChunkUpload.js'
import permissionRouter from './filePermissions.js'

const router = Router()
router.use(authenticateToken)

router.use(operationRouter)
router.use(workerRouter)
router.use(chunkUploadRouter)
router.use(permissionRouter)

export default router
