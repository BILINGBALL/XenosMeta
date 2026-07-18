-- GIN index: 通用 JSONB 查询（支持 @>, ?, ?|, ?& 操作符）
CREATE INDEX IF NOT EXISTS idx_dynamic_record_data_gin
    ON dynamic_record USING GIN (data);

-- GIN jsonb_path_ops: 优化路径查询（@> 操作符），比通用 GIN 更小更快
CREATE INDEX IF NOT EXISTS idx_dynamic_record_data_path_ops
    ON dynamic_record USING GIN (data jsonb_path_ops);

-- Group path 前缀查询索引（物化路径优化）
CREATE INDEX IF NOT EXISTS idx_group_path
    ON "Group" (path text_pattern_ops);
