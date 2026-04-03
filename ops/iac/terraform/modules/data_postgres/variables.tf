variable "env_name" {
  type        = string
  description = "Environment name."
}

variable "engine_version" {
  type        = string
  description = "PostgreSQL engine version."
}

variable "storage_gib" {
  type        = number
  description = "Allocated storage in GiB."
}
