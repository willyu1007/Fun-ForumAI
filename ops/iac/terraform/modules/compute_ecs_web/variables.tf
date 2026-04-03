variable "env_name" {
  type        = string
  description = "Environment name."
}

variable "instance_type" {
  type        = string
  description = "ECS instance type."
}

variable "web_vswitch_id" {
  type        = string
  description = "vSwitch id for ECS web."
}
