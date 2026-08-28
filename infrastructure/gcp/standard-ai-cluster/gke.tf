terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.0.0"
    }
  }
}

provider "google" {
  project     = "vish-aiops"
  region      = "europe-west1"
  impersonate_service_account = "infra-sa@vish-aiops.iam.gserviceaccount.com"
}
resource "google_container_cluster" "ai_cluster" {
  allow_net_admin                          = null
  datapath_provider                        = "LEGACY_DATAPATH"
  default_max_pods_per_node                = 110
  deletion_protection                      = true
  description                              = null
  disable_l4_lb_firewall_reconciliation    = false
  enable_cilium_clusterwide_network_policy = false
  enable_fqdn_network_policy               = false
  enable_intranode_visibility              = false
  enable_kubernetes_alpha                  = false
  enable_l4_ilb_subsetting                 = false
  enable_legacy_abac                       = false
  enable_multi_networking                  = false
  enable_shielded_nodes                    = true
  enable_tpu                               = false
  in_transit_encryption_config             = null
  initial_node_count                       = 1
  location                                 = "europe-west1-c"
  name                                     = "ai-cluster"
  network                                  = "projects/vish-aiops/global/networks/default"
  networking_mode                          = "VPC_NATIVE"
  node_locations                           = []
  private_ipv6_google_access               = null
  project                                  = "vish-aiops"
  remove_default_node_pool                 = true
  resource_labels                          = {}
  subnetwork                               = "projects/vish-aiops/regions/europe-west1/subnetworks/default"
  addons_config {
    cloudrun_config {
      disabled           = true
      load_balancer_type = null
    }
    config_connector_config {
      enabled = false
    }
    dns_cache_config {
      enabled = true
    }
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
    gcp_filestore_csi_driver_config {
      enabled = false
    }
    gcs_fuse_csi_driver_config {
      enabled = false
    }
    gke_backup_agent_config {
      enabled = false
    }
    http_load_balancing {
      disabled = false
    }
    network_policy_config {
      disabled = true
    }
    ray_operator_config {
      enabled = false
    }
  }
  anonymous_authentication_config {
    mode = "LIMITED"
  }
  binary_authorization {
    evaluation_mode = "DISABLED"
  }
  cluster_autoscaling {
    auto_provisioning_locations   = []
    autoscaling_profile           = "BALANCED"
    default_compute_class_enabled = false
    enabled                       = false
  }
  control_plane_endpoints_config {
    dns_endpoint_config {
      allow_external_traffic    = false
      enable_k8s_certs_via_dns  = false
      enable_k8s_tokens_via_dns = false
    }
    ip_endpoints_config {
      enabled = true
    }
  }
  cost_management_config {
    enabled = false
  }
  database_encryption {
    key_name = null
    state    = "DECRYPTED"
  }
  default_snat_status {
    disabled = false
  }
  dns_config {
    additive_vpc_scope_dns_domain = null
    cluster_dns                   = "KUBE_DNS"
    cluster_dns_domain            = null
    cluster_dns_scope             = null
  }
  ip_allocation_policy {
  }
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "STORAGE", "HPA", "POD", "DAEMONSET", "DEPLOYMENT", "STATEFULSET", "CADVISOR", "KUBELET", "DCGM", "JOBSET"]
    advanced_datapath_observability_config {
      enable_metrics = false
      enable_relay   = false
    }
    managed_prometheus {
      enabled = true
      auto_monitoring_config {
        scope = "NONE"
      }
    }
  }
  network_policy {
    enabled  = false
    provider = "PROVIDER_UNSPECIFIED"
  }
  node_pool_auto_config {
    resource_manager_tags = {}
    node_kubelet_config {
      insecure_kubelet_readonly_port_enabled = "FALSE"
    }
  }
  node_pool_defaults {
    node_config_defaults {
      insecure_kubelet_readonly_port_enabled = "FALSE"
      logging_variant                        = "DEFAULT"
      gcfs_config {
        enabled = false
      }
    }
  }
  notification_config {
    pubsub {
      enabled = false
      topic   = null
    }
  }
  pod_autoscaling {
    hpa_profile = "PERFORMANCE"
  }
  private_cluster_config {
    enable_private_endpoint     = false
    enable_private_nodes        = false
    master_ipv4_cidr_block      = null
    private_endpoint_subnetwork = null
    master_global_access_config {
      enabled = false
    }
  }
  rbac_binding_config {
    enable_insecure_binding_system_authenticated   = true
    enable_insecure_binding_system_unauthenticated = true
  }
  release_channel {
    channel = "REGULAR"
  }
  secret_manager_config {
    enabled = false
  }
  security_posture_config {
    mode               = "BASIC"
    vulnerability_mode = "VULNERABILITY_DISABLED"
  }
  service_external_ips_config {
    enabled = false
  }
  vertical_pod_autoscaling {
    enabled = false
  }
  workload_identity_config {
    workload_pool = null
  }
}

resource "google_container_node_pool" "default_pool" {
  cluster            = google_container_cluster.ai_cluster.name
  initial_node_count = 3
  location           = "europe-west1-c"
  max_pods_per_node  = 110
  name               = "default-pool"
  name_prefix        = null
  node_locations     = ["europe-west1-c"]
  project            = "vish-aiops"
  management {
    auto_repair  = true
    auto_upgrade = true
  }
  node_config {
    boot_disk_kms_key           = null
    disk_size_gb                = 100
    disk_type                   = "pd-standard"
    enable_confidential_storage = false
    flex_start                  = false
    image_type                  = "COS_CONTAINERD"
    labels                      = {}
    local_ssd_count             = 0
    local_ssd_encryption_mode   = null
    logging_variant             = "DEFAULT"
    machine_type                = "e2-medium"
    max_run_duration            = null
    metadata = {
      disable-legacy-endpoints = "true"
    }
    min_cpu_platform = null
    node_group       = null
    oauth_scopes     = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
    preemptible      = false
    resource_labels = {
      goog-gke-node-pool-provisioning-model = "on-demand"
    }
    resource_manager_tags = {}
    service_account       = "default"
    spot                  = false
    storage_pools         = []
    tags                  = []
    advanced_machine_features {
      enable_nested_virtualization = false
      performance_monitoring_unit  = null
      threads_per_core             = 0
    }
    boot_disk {
      disk_type              = "pd-standard"
      provisioned_iops       = 0
      provisioned_throughput = 0
      size_gb                = 100
    }
    ephemeral_storage_local_ssd_config {
      data_cache_count = 0
      local_ssd_count  = 0
    }
    kubelet_config {
      allowed_unsafe_sysctls                 = []
      container_log_max_files                = 0
      container_log_max_size                 = null
      cpu_cfs_quota                          = false
      cpu_cfs_quota_period                   = null
      cpu_manager_policy                     = null
      eviction_max_pod_grace_period_seconds  = 0
      image_gc_high_threshold_percent        = 0
      image_gc_low_threshold_percent         = 0
      image_maximum_gc_age                   = null
      image_minimum_gc_age                   = null
      insecure_kubelet_readonly_port_enabled = "FALSE"
      max_parallel_image_pulls               = 2
      pod_pids_limit                         = 0
      single_process_oom_kill                = false
    }
    shielded_instance_config {
      enable_integrity_monitoring = true
      enable_secure_boot          = false
    }
  }
  placement_policy {
    policy_name  = null
    tpu_topology = null
    type         = ""
  }
  queued_provisioning {
    enabled = false
  }
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
    strategy        = "SURGE"
  }
}