variable "env_name" {
  type        = string
  description = "Environment name (staging|prod)."
}

variable "region" {
  type        = string
  description = "Aliyun region."
}

variable "vpc_cidr" {
  type        = string
  description = "Primary VPC CIDR."
}
