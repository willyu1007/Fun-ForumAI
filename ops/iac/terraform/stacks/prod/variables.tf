variable "region" {
  type        = string
  description = "Aliyun region for the prod stack."
}

variable "vpc_cidr" {
  type        = string
  description = "Primary VPC CIDR for prod."
}

variable "domain_name" {
  type        = string
  description = "Primary public domain for prod."
}

variable "zone_name" {
  type        = string
  description = "DNS zone name for prod."
}

variable "certificate_id" {
  type        = string
  description = "Certificate id already issued/imported for prod."
}

variable "ecs_instance_type" {
  type        = string
  description = "ECS instance type for the web/API host."
}

variable "postgres_engine_version" {
  type        = string
  description = "Managed PostgreSQL engine version."
}

variable "postgres_storage_gib" {
  type        = number
  description = "Allocated PostgreSQL storage in GiB."
}

variable "runtime_redis_instance_class" {
  type        = string
  description = "Redis/Tair instance class for runtime queue/leader traffic."
}

variable "sse_redis_instance_class" {
  type        = string
  description = "Redis/Tair instance class for SSE broadcast traffic."
}

variable "media_bucket_name" {
  type        = string
  description = "OSS bucket name used by MEDIA_S3_BUCKET."
}

variable "media_endpoint" {
  type        = string
  description = "OSS endpoint consumed by MEDIA_S3_ENDPOINT."
}

variable "worker_template_path" {
  type        = string
  description = "Absolute or repo-relative path to the prod worker container-group template."
}
