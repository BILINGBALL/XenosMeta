// ==================== Common Types ====================

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  success: boolean
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// Helper: unwrap API response that may be PaginatedData or a plain array
export function unwrapList<T>(data: T[] | PaginatedData<T> | null | undefined): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if ('items' in data && Array.isArray(data.items)) return data.items
  return []
}

// ==================== Auth ====================

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: string
  id: string
  username: string
  nickname: string
  avatar: string | null
  email: string | null
  phone: string | null
}

export interface RegisterRequest {
  username: string
  password: string
  nickname?: string
  avatar?: string
  email?: string
  phone?: string
  profile?: Record<string, unknown>
  tenantId?: string
}

// ==================== User ====================

export interface User {
  id: string
  username: string
  nickname: string | null
  avatar: string | null
  email: string | null
  phone: string | null
  profile: Record<string, unknown> | null
  tenantId: string
  tenant?: { id: string; tenantName: string } | null
  status: boolean
  roles: Role[]
  groups: Group[]
  createdAt: string
  updatedAt?: string
}

export interface UpdateUserRequest {
  nickname?: string
  avatar?: string
  email?: string
  phone?: string
  profile?: Record<string, unknown>
  status?: boolean
  tenantId?: string
}

export interface AssignGroupRequest {
  groupId: string
}

// ==================== Tenant ====================

export interface Tenant {
  id: string
  tenantName: string
  tenantCode: string
  status: boolean
  scope?: string  // "system" | "tenant" | "experience"
  createdAt: string
  updatedAt: string
}

export interface CreateTenantRequest {
  id?: string
  tenantName: string
  tenantCode: string
}

export interface UpdateTenantRequest {
  tenantName?: string
  tenantCode?: string
  status?: boolean
}

// ==================== Group ====================

export interface GroupMember {
  id: string
  username: string
  nickname: string | null
  email: string | null
  avatar: string | null
  status: boolean
}

export interface Group {
  id: string
  groupName: string
  groupCode: string
  description?: string | null
  tenantId: string
  parentId: string | null
  status: boolean
  public?: boolean
  parent?: Group | null
  children?: Group[]
  users?: { user: GroupMember }[]
  createdAt: string
  updatedAt: string
}

export interface CreateGroupRequest {
  tenantId: string
  groupName: string
  groupCode?: string
  parentId?: string
}

export interface CreateRootGroupRequest {
  tenantId: string
  groupName: string
}

export interface UpdateGroupRequest {
  groupName?: string
  groupCode?: string
  status?: boolean
}

// ==================== Role ====================

export interface Role {
  id: string
  roleName: string
  roleCode: string
  tenantId: string  // shared 角色归属于系统租户
  description?: string | null
  status: boolean
  scope?: string  // "system" | "shared" | "tenant"
  permissions: Permission[]
  createdAt: string
  updatedAt?: string
}

export interface CreateRoleRequest {
  roleName: string
  roleCode: string
  scope?: string  // "system" | "shared" | "tenant"
  description?: string
  status?: boolean
}

export interface UpdateRoleRequest {
  roleName?: string
  roleCode?: string
  description?: string | null
  scope?: string
  status?: boolean
}

export interface AssignPermissionsRequest {
  permissionIds: string[]
}

// ==================== Permission ====================

export interface Permission {
  id: string
  permName: string
  permCode: string
  parentId: string | null
  type: number
  sort: number
  createdAt: string
  updatedAt?: string
}

export interface CreatePermissionRequest {
  permName: string
  permCode: string
  type?: number
  parentId?: string | null
  sort?: number
}

export interface UpdatePermissionRequest {
  permName?: string
  permCode?: string
  type?: number
  parentId?: string | null
  sort?: number
}

// ==================== Base / Dynamic Table ====================

export interface DynamicTable {
  id: string
  tableId: string
  name: string
  tenantId: string
  groupId: string
  createdBy: string
  fields?: DynamicField[]
  createdAt: string
  updatedAt: string
}

export interface CreateTableRequest {
  name: string
  tenantId: string
}

export interface UpdateTableRequest {
  name?: string
}

export interface DynamicField {
  id: string
  fieldId: string
  name: string
  type: FieldType
  options: string[] | null
  tableId: string
  tenantId: string
  groupId: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'user' | 'attachment' | 'reference'

export interface CreateFieldRequest {
  name: string
  type: FieldType
  options?: string[] | null
  tenantId: string
}

export interface UpdateFieldRequest {
  name?: string
  type?: FieldType
  options?: string[] | null
}

export interface DynamicRecord {
  id: string
  recordId: string
  tableId: string
  tenantId: string
  groupId: string
  data: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateRecordRequest {
  data: Record<string, unknown>
  tenantId: string
}

export interface UpdateRecordRequest {
  data: Record<string, unknown>
}

export interface ListRecordsRequest {
  tenantId: string
  [key: string]: unknown
}

// ==================== Field Reference ====================

export interface FieldReference {
  id: string
  refId: string
  fieldId: string
  sourceTableId: string
  sourceFields: string[]
  displayField: string
  valueField: string
  filterJson?: Record<string, unknown> | null
  description?: string | null
  groupId?: string | null
  createdBy?: string | null
  sourceTable?: { tableId: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface CreateReferenceRequest {
  fieldId: string
  sourceTableId: string
  sourceFields: string[]
  displayField?: string
  valueField: string
  filterJson?: Record<string, unknown>
  description?: string
}

export interface UpdateReferenceRequest {
  sourceFields?: string[]
  displayField?: string
  valueField?: string
  filterJson?: Record<string, unknown> | null
  description?: string
}

export interface LookupRecordsRequest {
  search?: string
  recordId?: string
  page?: number
  pageSize?: number
}

// ==================== Table Mirror ====================

export interface TableMirror {
  id: string
  mirrorId: string
  sourceTableId: string
  sourceGroupId?: string | null
  name: string
  description?: string | null
  groupId?: string | null
  visibleFields: string[]
  status?: string
  tenantId: string
  createdBy?: string | null
  sourceTable?: { tableId: string; name: string } | null
  sourceGroup?: { id: string; groupName: string; groupCode: string } | null
  targetGroup?: { id: string; groupName: string; groupCode: string } | null
  createdAt: string
  updatedAt: string
}

export interface CreateMirrorRequest {
  name: string
  description?: string
  groupId?: string | null
  visibleFields: string[]
}

export interface UpdateMirrorRequest {
  name?: string
  description?: string
  groupId?: string | null
  visibleFields?: string[]
}

export interface CategorizedMirrors {
  outgoing: TableMirror[]
  incoming: TableMirror[]
}

// ==================== System ====================

export interface InitSuperAdminRequest {
  userId: string
  tenantId: string
}

// ==================== Agent ====================

/** Agent 会话 */
export interface AgentConversation {
  id: string
  title: string
  userId: string
  tenantId: string
  status: 'active' | 'archived'
  pinned: boolean
  callCount: number
  tokenUsage: number
  createdAt: string
  updatedAt: string
  /** 最后一条消息的预览文本（截断），供侧边栏展示 */
  lastMessagePreview?: string | null
}

/** Agent 消息角色 */
export type AgentMessageRole = 'user' | 'assistant' | 'system' | 'tool'

/** Agent 消息 */
export interface AgentMessage {
  id: string
  conversationId: string
  role: AgentMessageRole
  content: string
  toolCalls?: unknown
  toolCallId?: string
  toolName?: string
  tokenCount: number
  createdAt: string
}

/** Agent 工具信息 */
export interface AgentTool {
  name: string
  description: string
  available: boolean
}

/** SSE 事件类型 */
export type AgentSSEEvent = 'thinking' | 'text' | 'tool_start' | 'tool_result' | 'error' | 'done' | 'usage'

/** SSE 事件数据 */
export interface AgentSSEEventData {
  thinking: { content: string }
  text: { content: string; delta: string }
  tool_start: { toolCallId: string; name: string; arguments: Record<string, unknown> }
  tool_result: { toolCallId: string; success: boolean; result: unknown; error?: string }
  error: { message: string; code?: string }
  done: { conversationId: string }
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

/** 前端展示用的消息（含工具调用过程） */
export interface ChatDisplayMessage {
  id: string
  role: AgentMessageRole
  content: string
  toolEvents?: ToolEvent[]
  timestamp: number
}

/** 工具调用事件（用于前端展示过程） */
export interface ToolEvent {
  toolCallId: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
  success?: boolean
  status: 'running' | 'done' | 'error'
}
