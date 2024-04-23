# Site-to-Site VPN

## **Sorry!Under construction!!**

![overview](overview.drawio.svg)

1. Create VPC-AWS(10.0.0.0/16) in Oregon region(us-west-2) and a Virtual Private Gateway is automatically created at the same time.
2. Create VPC-OnPremises(192.168.0.0/16) in Virginia region(us-east-1) and a Public Subnet Created.
3. A Customer Gateway is created in VPC-Onpremises.
4. A Virtual Private Gateway associate with VPC-AWS
5. Create VPN Connection.