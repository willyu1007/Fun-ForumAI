variable "env_name" {
  type        = string
  description = "Environment name."
}

variable "instance_class" {
  type        = string
  description = "Redis/Tair instance class."
}

variable "purpose" {
  type        = string
  description = "runtime | sse | shared"
}
