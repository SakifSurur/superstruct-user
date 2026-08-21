output "default_security_group_id" {
  description = "Id of the default VPC's default security group (managed with no rules)."
  value       = aws_default_security_group.default_vpc.id
}
