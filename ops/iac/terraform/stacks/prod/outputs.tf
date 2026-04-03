output "runbook_handoff" {
  value = {
    env_name              = "prod"
    vpc_id                = module.network.vpc_id
    web_vswitch_id        = module.network.web_vswitch_id
    worker_vswitch_id     = module.network.worker_vswitch_id
    alb_id                = module.entry_https.alb_id
    https_listener_id     = module.entry_https.https_listener_id
    deploy_host_addresses = module.compute_ecs_web.deploy_host_addresses
    worker_workload_id    = module.compute_eci_worker.worker_workload_id
    container_group_name  = module.compute_eci_worker.container_group_name
    postgres_endpoint     = module.data_postgres.endpoint
    postgres_port         = module.data_postgres.port
    runtime_redis_endpoint = module.data_redis_runtime.runtime_endpoint
    sse_redis_endpoint    = module.data_redis_sse.sse_endpoint
    media_bucket_name     = module.storage_media.bucket_name
    media_endpoint        = module.storage_media.endpoint
    domain_name           = module.dns_cert.domain_name
    certificate_id        = module.dns_cert.certificate_id
  }
  description = "Minimum prod handoff surface consumed by cloud runbooks, promote gates, and rollback planning."
}
