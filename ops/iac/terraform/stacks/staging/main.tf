locals {
  env_name = "staging"
}

module "network" {
  source   = "../../modules/network"
  env_name = local.env_name
  region   = var.region
  vpc_cidr = var.vpc_cidr
}

module "dns_cert" {
  source      = "../../modules/dns_cert"
  env_name    = local.env_name
  domain_name = var.domain_name
  zone_name   = var.zone_name
}

module "entry_https" {
  source         = "../../modules/entry_https"
  env_name       = local.env_name
  domain_name    = var.domain_name
  certificate_id = var.certificate_id
}

module "compute_ecs_web" {
  source         = "../../modules/compute_ecs_web"
  env_name       = local.env_name
  instance_type  = var.ecs_instance_type
  web_vswitch_id = module.network.web_vswitch_id
}

module "compute_eci_worker" {
  source                = "../../modules/compute_eci_worker"
  env_name              = local.env_name
  worker_vswitch_id     = module.network.worker_vswitch_id
  workload_template_path = var.worker_template_path
}

module "data_postgres" {
  source         = "../../modules/data_postgres"
  env_name       = local.env_name
  engine_version = var.postgres_engine_version
  storage_gib    = var.postgres_storage_gib
}

module "data_redis_runtime" {
  source         = "../../modules/data_redis"
  env_name       = local.env_name
  instance_class = var.runtime_redis_instance_class
  purpose        = "runtime"
}

module "data_redis_sse" {
  source         = "../../modules/data_redis"
  env_name       = local.env_name
  instance_class = var.sse_redis_instance_class
  purpose        = "sse"
}

module "storage_media" {
  source      = "../../modules/storage_media"
  env_name    = local.env_name
  bucket_name = var.media_bucket_name
  endpoint    = var.media_endpoint
}
