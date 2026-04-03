output "vpc_id" {
  value       = null
  description = "VPC id for downstream modules."
}

output "web_vswitch_id" {
  value       = null
  description = "vSwitch for ECS web instances."
}

output "worker_vswitch_id" {
  value       = null
  description = "vSwitch for ECI worker container groups."
}
