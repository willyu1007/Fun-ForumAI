variable "env_name" {
  type        = string
  description = "Environment name."
}

variable "worker_vswitch_id" {
  type        = string
  description = "vSwitch id for ECI worker."
}

variable "workload_template_path" {
  type        = string
  description = "Repo-tracked container-group template path."
}
