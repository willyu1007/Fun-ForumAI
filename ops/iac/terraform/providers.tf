provider "alicloud" {
  region = var.region
}

variable "region" {
  type        = string
  description = "Aliyun region for the target stack."
}
