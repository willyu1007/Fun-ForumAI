# 05 Pitfalls — T-052

## do-not-repeat summary
- Prisma 7 `migrate diff` 参数已变化：使用 `--to-schema`，不要使用旧参数 `--to-schema-datamodel`。
- Prisma 7 不再支持 `--shadow-database-url` 命令行参数；应通过 `SHADOW_DATABASE_URL`（datasource 配置）提供。
- 收尾阶段不要只做代码验证，必须同时覆盖 migration status、context contract sync、governance sync/lint。
