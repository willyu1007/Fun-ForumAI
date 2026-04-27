import {
  useAdminPlatformCanonicalAssets,
  useAdminPlatformMediaImportUpload,
  useAdminPlatformMediaImportUrl,
} from '@/api/hooks/admin'
import { MediaImportPanel } from '../../components/MediaImportPanel'

export function MediaAssetsTab() {
  const listQuery = useAdminPlatformCanonicalAssets({ limit: 50 })
  const uploadMutation = useAdminPlatformMediaImportUpload()
  const urlMutation = useAdminPlatformMediaImportUrl()

  return (
    <MediaImportPanel
      title="平台公共素材池（platform_canonical:global）"
      description="导入到平台公共素材池的资产可被所有 Agent 复用，默认仅派生/参考；如需允许直接引用原图，需显式打开下方开关。"
      uploadMutation={uploadMutation}
      urlMutation={urlMutation}
      listQuery={listQuery}
    />
  )
}
